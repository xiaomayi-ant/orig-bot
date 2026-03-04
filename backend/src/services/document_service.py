"""
Document service layer for handling PDF uploads and management.
Provides high-level API for document processing operations.
"""
from typing import Dict, Any, List, Optional
from fastapi import UploadFile

from ..tools.document.processor import PDFProcessor
from ..tools.document.search_engine import DocumentSearchEngine
from ..tools.document.classifier import DOCUMENT_CATEGORIES
from ..core.config import is_vector_search_configured


class DocumentService:
    """High-level service for document operations."""
    
    def __init__(self):
        # Lazy init to avoid startup-time connection failures impacting service boot.
        self.pdf_processor: Optional[PDFProcessor] = None
        self.search_engine: Optional[DocumentSearchEngine] = None
        self._vector_enabled = is_vector_search_configured()
        self._pdf_init_error: Optional[str] = None
        self._search_init_error: Optional[str] = None

    def _disabled_reason(self, component: str = "vector") -> str:
        if not self._vector_enabled:
            return "Document vector feature is disabled: missing MILVUS_ADDRESS or embedding API key"
        if component == "pdf" and self._pdf_init_error:
            return f"PDF processor unavailable: {self._pdf_init_error}"
        if component == "search" and self._search_init_error:
            return f"Search engine unavailable: {self._search_init_error}"
        if self._pdf_init_error:
            return f"PDF processor unavailable: {self._pdf_init_error}"
        if self._search_init_error:
            return f"Search engine unavailable: {self._search_init_error}"
        return "Document vector feature unavailable"

    def _ensure_pdf_processor(self) -> Optional[PDFProcessor]:
        if self.pdf_processor is not None:
            return self.pdf_processor
        if not self._vector_enabled:
            return None
        if self._pdf_init_error:
            return None
        try:
            processor = PDFProcessor()
            if not processor._check_prerequisites():
                self._pdf_init_error = "milvus/embeddings not ready"
                return None
            self.pdf_processor = processor
            return self.pdf_processor
        except Exception as e:
            self._pdf_init_error = str(e)
            return None

    def _ensure_search_engine(self) -> Optional[DocumentSearchEngine]:
        if self.search_engine is not None:
            return self.search_engine
        if not self._vector_enabled:
            return None
        if self._search_init_error:
            return None
        try:
            engine = DocumentSearchEngine()
            if not engine._check_prerequisites():
                self._search_init_error = "milvus/embeddings not ready"
                return None
            self.search_engine = engine
            return self.search_engine
        except Exception as e:
            self._search_init_error = str(e)
            return None
    
    async def upload_and_process_pdf(self, 
                                   file: UploadFile,
                                   user_category: Optional[str] = None,
                                   user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload and process a PDF file.
        
        Args:
            file: Uploaded PDF file
            user_category: Optional user-specified category
            
        Returns:
            Processing result
        """
        try:
            # Validate file type
            if not file.filename.lower().endswith('.pdf'):
                return {
                    "success": False,
                    "error": "Only PDF files are supported",
                    "filename": file.filename
                }
            
            # Validate category if provided
            if user_category and user_category.lower() not in DOCUMENT_CATEGORIES:
                return {
                    "success": False,
                    "error": f"Invalid category: {user_category}. Valid categories: {', '.join(DOCUMENT_CATEGORIES.keys())}",
                    "filename": file.filename
                }
            
            # Read file content
            file_content = await file.read()
            
            # Process PDF
            processor = self._ensure_pdf_processor()
            if not processor:
                return {
                    "success": False,
                    "error": self._disabled_reason("pdf"),
                    "filename": file.filename,
                }

            result = await processor.process_pdf_content(
                file_content=file_content,
                filename=file.filename,
                user_category=user_category.lower() if user_category else None,
                user_id=user_id,
            )
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Upload processing error: {str(e)}",
                "filename": file.filename if file else "unknown"
            }
    
    async def search_documents(self,
                             query: str,
                             categories: Optional[List[str]] = None,
                             filename: Optional[str] = None,
                             limit: int = 5) -> Dict[str, Any]:
        """
        Search documents with flexible filtering.
        
        Args:
            query: Search query
            categories: List of categories to search
            filename: Specific filename filter
            limit: Maximum results
            
        Returns:
            Search results
        """
        try:
            engine = self._ensure_search_engine()
            if not engine:
                return {
                    "success": False,
                    "error": self._disabled_reason("search"),
                    "results": [],
                }

            return await engine.search_documents(
                query=query,
                categories=categories,
                filename=filename,
                limit=limit
            )
        except Exception as e:
            return {
                "success": False,
                "error": f"Search error: {str(e)}",
                "results": []
            }
    
    async def get_categories_info(self) -> Dict[str, Any]:
        """Get information about available document categories."""
        try:
            categories_info = {}
            for category, info in DOCUMENT_CATEGORIES.items():
                categories_info[category] = {
                    "name": info["name"],
                    "description": info["description"],
                    "partition": info["partition"]
                }
            
            # Try to get partition statistics
            try:
                engine = self._ensure_search_engine()
                if engine and engine.partition_manager:
                    partition_stats = await engine.partition_manager.get_partition_stats()
                    
                    for category, info in categories_info.items():
                        partition_name = info["partition"]
                        partition_data = partition_stats.get("partitions", {}).get(partition_name, {})
                        info["document_count"] = partition_data.get("row_count", 0)
            except Exception:
                # Continue without stats if there's an error
                pass
            
            return {
                "success": True,
                "categories": categories_info,
                "total_categories": len(categories_info),
                "vector_enabled": self._vector_enabled,
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Error getting categories: {str(e)}",
                "categories": {}
            }
    
    async def delete_document(self, filename: str) -> Dict[str, Any]:
        """Delete a document by filename."""
        try:
            processor = self._ensure_pdf_processor()
            if not processor:
                return {
                    "success": False,
                    "error": self._disabled_reason("pdf"),
                    "filename": filename,
                }
            return await processor.delete_document_by_filename(filename)
        except Exception as e:
            return {
                "success": False,
                "error": f"Delete error: {str(e)}",
                "filename": filename
            }
    
    async def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics and health information."""
        try:
            # Do not force-init Milvus dependencies in health/stats path.
            # This keeps startup and routine health checks quiet when Milvus is down.
            processor = self.pdf_processor
            engine = self.search_engine
            processing_stats = (
                await processor.get_processing_stats()
                if processor
                else {
                    "processor_status": "disabled" if (not self._vector_enabled or self._pdf_init_error) else "not_initialized",
                    "reason": self._disabled_reason("pdf") if (not self._vector_enabled or self._pdf_init_error) else "lazy_init_not_triggered",
                }
            )
            search_health = (
                await engine.get_search_health()
                if engine
                else {
                    "engine_status": "disabled" if (not self._vector_enabled or self._search_init_error) else "not_initialized",
                    "reason": self._disabled_reason("search") if (not self._vector_enabled or self._search_init_error) else "lazy_init_not_triggered",
                }
            )
            
            return {
                "success": True,
                "processing_stats": processing_stats,
                "search_health": search_health,
                "timestamp": None  # Will be set by API
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Stats error: {str(e)}"
            }
    
    async def get_document_recommendations(self, filename: str, limit: int = 3) -> Dict[str, Any]:
        """Get document recommendations based on similarity."""
        try:
            engine = self._ensure_search_engine()
            if not engine:
                return {
                    "success": False,
                    "error": self._disabled_reason("search"),
                    "recommendations": [],
                }
            return await engine.get_document_recommendations(
                filename=filename,
                limit=limit
            )
        except Exception as e:
            return {
                "success": False,
                "error": f"Recommendations error: {str(e)}",
                "recommendations": []
            }
