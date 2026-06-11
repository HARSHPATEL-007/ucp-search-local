import UIKit
import Combine
import Speech

/**
 * iOS Search View Controller - Hub-and-Workspace Paradigm
 * Bottom-sheet overlay with native iOS application switcher-style cards
 */
class SearchViewController: UIViewController {

    private let viewModel: SearchViewModel
    private var cancellables = Set<AnyCancellable>()

    private lazy var searchTextField: UISearchTextField = {
        let field = UISearchTextField()
        field.placeholder = "Search workspaces..."
        field.delegate = self
        return field
    }()

    private lazy var collectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.itemSize = CGSize(width: view.bounds.width - 32, height: 80)
        layout.minimumLineSpacing = 12

        let cv = UICollectionView(frame: .zero, collectionViewLayout: layout)
        cv.register(SearchResultCell.self, forCellWithReuseIdentifier: "SearchResultCell")
        cv.delegate = self
        cv.dataSource = self
        cv.backgroundColor = .systemBackground
        return cv
    }()

    private lazy var voiceButton: UIButton = {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: "mic.fill"), for: .normal)
        button.tintColor = .systemBlue
        button.addTarget(self, action: #selector(toggleVoiceSearch), for: .touchUpInside)
        return button
    }()

    private lazy var filterChipsView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.estimatedItemSize = UICollectionViewFlowLayout.automaticSize

        let cv = UICollectionView(frame: .zero, collectionViewLayout: layout)
        cv.register(FilterChipCell.self, forCellWithReuseIdentifier: "FilterChipCell")
        cv.delegate = self
        cv.dataSource = self
        cv.backgroundColor = .clear
        return cv
    }()

    init(viewModel: SearchViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        bindViewModel()
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground

        let stackView = UIStackView(arrangedSubviews: [searchTextField, filterChipsView, collectionView])
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(stackView)

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stackView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16)
        ])

        searchTextField.rightView = voiceButton
        searchTextField.rightViewMode = .always
    }

    private func bindViewModel() {
        viewModel.$results
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.collectionView.reloadData()
            }
            .store(in: &cancellables)

        viewModel.$voiceState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.updateVoiceUI(state: state)
            }
            .store(in: &cancellables)
    }

    @objc private func toggleVoiceSearch() {
        if viewModel.voiceState.isListening {
            viewModel.stopVoiceSearch()
        } else {
            viewModel.startVoiceSearch()
        }
    }

    private func updateVoiceUI(state: VoiceSearchState) {
        if state.isListening {
            voiceButton.tintColor = .systemRed
            voiceButton.setImage(UIImage(systemName: "mic.fill.badge.plus"), for: .normal)
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        } else {
            voiceButton.tintColor = .systemBlue
            voiceButton.setImage(UIImage(systemName: "mic.fill"), for: .normal)
        }
    }
}

// MARK: - UICollectionViewDataSource
extension SearchViewController: UICollectionViewDataSource {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        if collectionView == filterChipsView {
            return viewModel.touchTokens.count
        }
        return viewModel.results.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        if collectionView == filterChipsView {
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "FilterChipCell", for: indexPath) as! FilterChipCell
            cell.configure(with: viewModel.touchTokens[indexPath.item])
            return cell
        }

        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "SearchResultCell", for: indexPath) as! SearchResultCell
        cell.configure(with: viewModel.results[indexPath.item])
        return cell
    }
}

// MARK: - UICollectionViewDelegate
extension SearchViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        if collectionView == filterChipsView {
            let token = viewModel.touchTokens[indexPath.item]
            viewModel.applyTouchToken(token)
            let generator = UISelectionFeedbackGenerator()
            generator.selectionChanged()
        } else {
            let result = viewModel.results[indexPath.item]
            viewModel.transitionToResult(result)
        }
    }
}

// MARK: - UISearchTextFieldDelegate
extension SearchViewController: UISearchTextFieldDelegate {
    func textFieldDidChangeSelection(_ textField: UITextField) {
        viewModel.updateQuery(textField.text ?? "")
    }
}

// MARK: - Swipe Actions
extension SearchViewController {
    func collectionView(_ collectionView: UICollectionView, 
                       trailingSwipeActionsConfigurationForItemAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let pinAction = UIContextualAction(style: .normal, title: "Pin") { [weak self] _, _, completion in
            let result = self?.viewModel.results[indexPath.item]
            self?.viewModel.handleSwipeAction(result: result!, direction: .left)
            completion(true)
        }
        pinAction.backgroundColor = .systemOrange
        pinAction.image = UIImage(systemName: "pin.fill")

        return UISwipeActionsConfiguration(actions: [pinAction])
    }

    func collectionView(_ collectionView: UICollectionView,
                       leadingSwipeActionsConfigurationForItemAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let appendAction = UIContextualAction(style: .normal, title: "Add") { [weak self] _, _, completion in
            let result = self?.viewModel.results[indexPath.item]
            self?.viewModel.handleSwipeAction(result: result!, direction: .right)
            completion(true)
        }
        appendAction.backgroundColor = .systemGreen
        appendAction.image = UIImage(systemName: "plus.circle.fill")

        return UISwipeActionsConfiguration(actions: [appendAction])
    }
}
