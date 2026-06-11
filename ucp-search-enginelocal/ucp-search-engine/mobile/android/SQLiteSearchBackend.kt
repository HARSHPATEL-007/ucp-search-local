package com.ucp.mobile.search

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.core.database.sqlite.transaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * SQLite FTS5 Search Backend
 * On-device lightweight vector/text indexes for immediate offline workspace context
 */
class SQLiteSearchBackend(
    context: Context,
    private val userId: String
) : SearchBackend {

    override val name = "device_sqlite"
    override val supportsStreaming = false
    override val priority = 1

    private val dbHelper: SearchDatabaseHelper = SearchDatabaseHelper(context)

    companion object {
        const val DATABASE_NAME = "ucp_search.db"
        const val DATABASE_VERSION = 1
        const val FTS_TABLE = "search_index"
        const val WORKSPACE_TABLE = "workspace_context"
        const val PINNED_TABLE = "pinned_results"
    }

    private class SearchDatabaseHelper(context: Context) : 
        SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("CREATE VIRTUAL TABLE IF NOT EXISTS $FTS_TABLE USING fts5(" +
                "title, subtitle, content, doc_type, workflow_id, service_domain, " +
                "owner_id, region_code, last_modified, json_payload)")

            db.execSQL("CREATE TABLE IF NOT EXISTS $WORKSPACE_TABLE (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, " +
                "workflow_id TEXT, service_domain TEXT, access_count INTEGER DEFAULT 1, " +
                "last_accessed INTEGER, geofence_region TEXT)")

            db.execSQL("CREATE TABLE IF NOT EXISTS $PINNED_TABLE (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, " +
                "result_id TEXT NOT NULL, result_type TEXT, pinned_at INTEGER, " +
                "UNIQUE(user_id, result_id))")

            db.execSQL("CREATE INDEX IF NOT EXISTS idx_workspace_user ON $WORKSPACE_TABLE(user_id)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_workspace_last ON $WORKSPACE_TABLE(last_accessed DESC)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // Migration logic for future versions
        }
    }

    override suspend fun search(query: SearchQuery, signal: AbortSignal?): List<SearchResult> = 
        withContext(Dispatchers.IO) {
            val db = dbHelper.readableDatabase
            val results = mutableListOf<SearchResult>()

            val ftsQuery = buildFTSQuery(query)

            val cursor = db.rawQuery(
                "SELECT s.*, w.access_count as recency_score, " +
                "CASE WHEN s.workflow_id = ? THEN 3.0 " +
                "WHEN s.service_domain = ? THEN 2.0 " +
                "WHEN w.workflow_id IS NOT NULL THEN 1.5 ELSE 1.0 END as context_boost " +
                "FROM $FTS_TABLE s LEFT JOIN $WORKSPACE_TABLE w " +
                "ON s.workflow_id = w.workflow_id AND w.user_id = ? " +
                "WHERE $FTS_TABLE MATCH ? ORDER BY (rank * context_boost) DESC LIMIT 50",
                arrayOf(
                    query.context.activeWorkflowId ?: "",
                    query.context.activeServiceDomain ?: "",
                    userId,
                    ftsQuery
                )
            )

            cursor.use {
                while (it.moveToNext()) {
                    results.add(cursorToResult(it))
                }
            }

            results
        }

    private fun buildFTSQuery(query: SearchQuery): String {
        val tokens = query.parsed.textTokens.joinToString(" ") { "${'$'}it*" }

        val filters = query.parsed.prefixFlags.map { flag ->
            when (flag.prefix) {
                "service" -> "service_domain:${'$'}{flag.value}"
                "status" -> "doc_type:${'$'}{flag.value}"
                "client" -> "owner_id:${'$'}{flag.value}"
                else -> "${'$'}{flag.prefix}:${'$'}{flag.value}"
            }
        }

        return if (filters.isNotEmpty()) {
            "$tokens ${'$'}{filters.joinToString(" AND ")}"
        } else {
            tokens
        }
    }

    private fun cursorToResult(cursor: android.database.Cursor): SearchResult {
        return SearchResult(
            id = cursor.getString(cursor.getColumnIndexOrThrow("rowid")),
            type = cursor.getString(cursor.getColumnIndexOrThrow("doc_type")),
            title = cursor.getString(cursor.getColumnIndexOrThrow("title")),
            metadata = ResultMetadata(
                badges = listOf(cursor.getString(cursor.getColumnIndexOrThrow("service_domain"))),
                lastModified = cursor.getLong(cursor.getColumnIndexOrThrow("last_modified"))
            ),
            actionability = ActionabilityConfig(
                primaryAction = ActionDefinition("open", "Open", "open", false),
                secondaryActions = listOf(
                    ActionDefinition("pin", "Pin", "pin", false),
                    ActionDefinition("share", "Share", "share", false)
                ),
                previewAvailable = true,
                swipeGestures = mapOf("right" to "append", "left" to "pin")
            ),
            source = "local_index",
            score = cursor.getDouble(cursor.getColumnIndexOrThrow("context_boost")),
            contextRelevance = 0.8
        )
    }

    suspend fun indexDocument(doc: IndexableDocument) = withContext(Dispatchers.IO) {
        val db = dbHelper.writableDatabase
        db.transaction {
            db.execSQL("INSERT OR REPLACE INTO $FTS_TABLE (" +
                "title, subtitle, content, doc_type, workflow_id, service_domain, " +
                "owner_id, region_code, last_modified, json_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                arrayOf(doc.title, doc.subtitle, doc.content, doc.docType,
                    doc.workflowId, doc.serviceDomain, doc.ownerId,
                    doc.regionCode, doc.lastModified, doc.jsonPayload))
        }
    }

    suspend fun recordWorkspaceAccess(workflowId: String?, serviceDomain: String?) = 
        withContext(Dispatchers.IO) {
            val db = dbHelper.writableDatabase
            db.transaction {
                db.execSQL("INSERT INTO $WORKSPACE_TABLE (user_id, workflow_id, service_domain, last_accessed) " +
                    "VALUES (?, ?, ?, ?) ON CONFLICT(user_id, workflow_id) DO UPDATE SET " +
                    "access_count = access_count + 1, last_accessed = excluded.last_accessed",
                    arrayOf(userId, workflowId ?: "", serviceDomain ?: "", System.currentTimeMillis()))
            }
        }
}

data class IndexableDocument(
    val title: String,
    val subtitle: String?,
    val content: String,
    val docType: String,
    val workflowId: String?,
    val serviceDomain: String,
    val ownerId: String?,
    val regionCode: String?,
    val lastModified: Long,
    val jsonPayload: String
)
