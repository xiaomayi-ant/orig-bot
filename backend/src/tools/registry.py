from .date import date_calculator_tool
from .web.tavily import tavily_search_tool
from ..core.config import (
    is_mysql_configured,
    is_vector_search_configured,
    is_neo4j_configured,
)

# MySQL tools (optional)
MYSQL_TOOLS_AVAILABLE = False
if is_mysql_configured():
    try:
        from .sql.mysql_tool import (
            mysql_simple_query_tool,
            mysql_aggregated_query_tool,
            mysql_join_query_tool,
            mysql_custom_query_tool,
        )
        MYSQL_TOOLS_AVAILABLE = True
    except Exception as e:
        MYSQL_TOOLS_AVAILABLE = False
        print(f"[Registry] MySQL tools disabled: {e}")
else:
    print("[Registry] MySQL tools disabled: missing MYSQL_* configuration")

# KG tools (optional)
try:
    if is_neo4j_configured():
        from .kg.neo4j_tools import (
            graphiti_search_tool,
            graphiti_add_episode_tool,
            graphiti_add_entity_tool,
            graphiti_add_edge_tool,
            graphiti_ingest_detect_tool,
            graphiti_ingest_commit_tool,
        )
        KG_TOOLS_AVAILABLE = True
    else:
        KG_TOOLS_AVAILABLE = False
        print("[Registry] KG tools disabled: missing NEO4J_* configuration")
except Exception as e:
    KG_TOOLS_AVAILABLE = False
    print(f"[Registry] KG tools disabled: {e}")

# Document processing tools (new)
try:
    if is_vector_search_configured():
        from .document.document_tools import (
            search_documents_tool,
            # search_documents_by_category_tool,
            # list_document_categories_tool,
            # get_document_recommendations_tool,
            # get_document_processing_stats_tool,
            # upload_pdf_tool,  # Available but not registered for AI use
            # delete_document_tool,  # Available but not registered for AI use
        )
        DOCUMENT_TOOLS_AVAILABLE = True
    else:
        DOCUMENT_TOOLS_AVAILABLE = False
        print("[Registry] Document tools disabled: missing MILVUS/Embedding configuration")
except Exception as e:
    DOCUMENT_TOOLS_AVAILABLE = False
    print(f"[Registry] Document tools disabled: {e}")

# Central registry used by graph.py
ALL_TOOLS_LIST = [
    # Core always-on tools
    date_calculator_tool,
    tavily_search_tool,
]

if MYSQL_TOOLS_AVAILABLE:
    ALL_TOOLS_LIST.extend([
        mysql_simple_query_tool,
        mysql_aggregated_query_tool,
        mysql_join_query_tool,
        mysql_custom_query_tool,
    ])

# Add document tools if available
if DOCUMENT_TOOLS_AVAILABLE:
    ALL_TOOLS_LIST.extend([
        search_documents_tool,
        # search_documents_by_category_tool,
        # list_document_categories_tool,
        # get_document_recommendations_tool,
        # get_document_processing_stats_tool,
    ]) 

# Add KG tools if available
if KG_TOOLS_AVAILABLE:
    ALL_TOOLS_LIST.extend([
        graphiti_search_tool,
        graphiti_add_episode_tool,
        graphiti_add_entity_tool,
        graphiti_add_edge_tool,
        graphiti_ingest_detect_tool,
        graphiti_ingest_commit_tool,
    ])

# Fast lookup by tool name - 在所有工具添加完成后构建
TOOL_BY_NAME = {t.name: t for t in ALL_TOOLS_LIST}
