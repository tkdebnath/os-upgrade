from rest_framework import viewsets, serializers, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType
from django_filters.rest_framework import DjangoFilterBackend
from swim_backend.core.models import ActivityLog
from swim_backend.core.pagination import ActivityLogPagination
from datetime import datetime, timedelta


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    content_type_name = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'user_name', 'action', 'action_display', 
            'content_type', 'content_type_name', 'object_id', 'object_repr', 
            'changes', 'ip_address', 'user_agent', 'timestamp'
        ]
        read_only_fields = fields
    
    def get_content_type_name(self, obj):
        if obj.content_type:
            return obj.content_type.model
        return None
    
    def get_action_display(self, obj):
        return obj.get_action_display()


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing activity logs.
    Regular users can only see their own logs.
    Admins can see all logs.
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ActivityLogPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'user', 'content_type']
    search_fields = ['object_repr', 'user__username', 'ip_address']
    ordering_fields = ['timestamp', 'action', 'user']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        """Users can only see their own logs unless they're superuser"""
        queryset = ActivityLog.objects.all().select_related('user', 'content_type')
        
        if not self.request.user.is_superuser:
            queryset = queryset.filter(user=self.request.user)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def my_logs(self, request):
        """Get recent logs for the current user"""
        logs = ActivityLog.objects.filter(user=request.user).select_related('user', 'content_type')[:50]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get activity summary"""
        from django.db.models import Count
        
        queryset = ActivityLog.objects.all() if request.user.is_superuser else ActivityLog.objects.filter(user=request.user)
        
        # Get date range for last 30 days
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_queryset = queryset.filter(timestamp__gte=thirty_days_ago)
        
        summary = {
            'total_actions': queryset.count(),
            'recent_actions': recent_queryset.count(),
            'by_action': dict(queryset.values_list('action').annotate(count=Count('action'))),
            'by_user': dict(queryset.values_list('user__username').annotate(count=Count('user'))) if request.user.is_superuser else {},
            'recent_activity': ActivityLogSerializer(queryset[:10], many=True).data
        }
        
        return Response(summary)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get statistics for dashboard"""
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        
        queryset = ActivityLog.objects.all() if request.user.is_superuser else ActivityLog.objects.filter(user=request.user)
        
        # Last 7 days activity
        seven_days_ago = datetime.now() - timedelta(days=7)
        daily_stats = queryset.filter(timestamp__gte=seven_days_ago).annotate(
            date=TruncDate('timestamp')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')
        
        return Response({
            'daily_activity': list(daily_stats),
            'total_logs': queryset.count(),
            'action_breakdown': dict(queryset.values_list('action').annotate(count=Count('action')))
        })
