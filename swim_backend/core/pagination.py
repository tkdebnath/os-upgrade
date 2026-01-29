from rest_framework.pagination import PageNumberPagination


class ActivityLogPagination(PageNumberPagination):
    """Custom pagination for activity logs with configurable page size"""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 1000
    page_query_param = 'page'
