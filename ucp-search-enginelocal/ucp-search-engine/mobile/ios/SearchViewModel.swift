import Foundation
import Combine
import Speech
import SQLite3

/**
 * iOS Search ViewModel
 * Coordinates SQLite FTS5, remote API, and voice search with Combine
 */
class SearchViewModel: ObservableObject {

    @Published var results: [MobileSearchResult] = []
    @Published var query: String = ""
    @Published var voiceState: VoiceSearchState = VoiceSearchState(isListening: false, transcript: "", confidence: 0, interimResults: [])
    @Published var touchTokens: [TouchToken] = []

    private let searchContext: MobileSearchContext
    private let localBackend: SQLiteSearchBackend
    private let remoteBackend: RemoteSearchBackend
    private let orchestrator = SearchOrchestrator()
    private let speechRecognizer = SFSpeechRecognizer()
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private let audioEngine = AVAudioEngine()

    private var cancellables = Set<AnyCancellable>()

    init(context: MobileSearchContext) {
        self.searchContext = context
        self.localBackend = SQLiteSearchBackend(userId: context.userId)
        self.remoteBackend = RemoteSearchBackend(orgId: context.orgId)

        orchestrator.registerBackend(localBackend)
        orchestrator.registerBackend(remoteBackend)

        setupTouchTokens()
        bindQuery()
    }

    private func setupTouchTokens() {
        touchTokens = [
            TouchToken(id: "active", label: "Active", icon: "bolt.fill", filterValue: "status:active", color: "#34C759"),
            TouchToken(id: "pending", label: "Pending", icon: "clock.fill", filterValue: "status:pending", color: "#FF9500"),
            TouchToken(id: "audit", label: "Audit", icon: "doc.text.fill", filterValue: "service:audit_assurance", color: "#5856D6"),
            TouchToken(id: "lending", label: "Lending", icon: "dollarsign.circle.fill", filterValue: "service:lending", color: "#007AFF"),
            TouchToken(id: "dcm", label: "DCM", icon: "chart.bar.fill", filterValue: "service:dcm", color: "#AF52DE"),
            TouchToken(id: "mine", label: "Mine", icon: "person.fill", filterValue: "assignee:self", color: "#FF3B30")
        ]
    }

    private func bindQuery() {
        $query
            .debounce(for: .milliseconds(150), scheduler: DispatchQueue.main)
            .removeDuplicates()
            .filter { !$0.isEmpty }
            .flatMap { [weak self] query -> AnyPublisher<[MobileSearchResult], Never> in
                guard let self = self else { return Just([]).eraseToAnyPublisher() }
                return self.performSearch(query: query)
            }
            .receive(on: DispatchQueue.main)
            .assign(to: &$results)
    }

    private func performSearch(query: String) -> AnyPublisher<[MobileSearchResult], Never> {
        Future { [weak self] promise in
            guard let self = self else {
                promise(.success([]))
                return
            }

            Task {
                do {
                    let session = try await self.orchestrator.executeSearch(
                        query,
                        self.searchContext,
                        requireLocalFirst: true,
                        timeoutMs: 5000
                    )
                    let mobileResults = session.results.map { $0.toMobileResult() }
                    promise(.success(mobileResults))
                } catch {
                    promise(.success([]))
                }
            }
        }
        .eraseToAnyPublisher()
    }

    func updateQuery(_ newQuery: String) {
        query = newQuery
    }

    func applyTouchToken(_ token: TouchToken) {
        let currentQuery = query
        let newQuery = currentQuery.contains("/filter:\(token.filterValue)") 
            ? currentQuery 
            : "\(currentQuery) /filter:\(token.filterValue)"
        updateQuery(newQuery)
    }

    func startVoiceSearch() {
        SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
            DispatchQueue.main.async {
                switch authStatus {
                case .authorized:
                    self?.beginVoiceRecording()
                case .denied, .restricted, .notDetermined:
                    self?.voiceState = VoiceSearchState(
                        isListening: false, 
                        transcript: "", 
                        confidence: 0, 
                        interimResults: [],
                        error: "Speech recognition not authorized"
                    )
                @unknown default:
                    break
                }
            }
        }
    }

    private func beginVoiceRecording() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest = recognitionRequest else { return }

            recognitionRequest.shouldReportPartialResults = true
            recognitionRequest.taskHint = .search

            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                guard let self = self else { return }

                if let result = result {
                    let transcript = result.bestTranscription.formattedString
                    self.voiceState = VoiceSearchState(
                        isListening: true,
                        transcript: transcript,
                        confidence: result.bestTranscription.segments.first?.confidence ?? 0,
                        interimResults: result.transcriptions.map { $0.formattedString }
                    )

                    if result.isFinal {
                        self.updateQuery(transcript)
                        self.stopVoiceSearch()
                    }
                }

                if error != nil {
                    self.stopVoiceSearch()
                }
            }

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                self.recognitionRequest?.append(buffer)
            }

            audioEngine.prepare()
            try audioEngine.start()

        } catch {
            voiceState = VoiceSearchState(
                isListening: false,
                transcript: "",
                confidence: 0,
                interimResults: [],
                error: error.localizedDescription
            )
        }
    }

    func stopVoiceSearch() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        recognitionRequest = nil
        recognitionTask = nil

        voiceState = VoiceSearchState(isListening: false, transcript: voiceState.transcript, confidence: 0, interimResults: [])
    }

    func handleSwipeAction(result: MobileSearchResult, direction: SwipeDirection) {
        switch direction {
        case .right:
            appendToWorkspace(result)
        case .left:
            pinResult(result)
        }
    }

    func transitionToResult(_ result: MobileSearchResult) {
        // Transition active view stack into workflow target
        NotificationCenter.default.post(
            name: .init("TransitionToWorkflow"),
            object: nil,
            userInfo: ["resultId": result.id, "resultType": result.type]
        )
    }

    private func appendToWorkspace(_ result: MobileSearchResult) {
        WorkspaceManager.shared.appendToActiveWorkspace(resultId: result.id, type: result.type)
    }

    private func pinResult(_ result: MobileSearchResult) {
        PinnedResultsManager.shared.pinResult(userId: searchContext.userId, result: result)
    }
}

struct MobileSearchResult: Identifiable {
    let id: String
    let type: String
    let title: String
    let subtitle: String?
    let badges: [String]
    let score: Double
    let contextRelevance: Double
}

enum SwipeDirection {
    case left, right
}
