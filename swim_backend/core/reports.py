from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Job
from django.utils.dateparse import parse_date
from .views import JobSerializer

class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly ViewSet for generating Reports.
    """
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    
    def get_queryset(self):
        queryset = Job.objects.all().order_by('-created_at')
        
        # Date Range Filter
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        user_id = self.request.query_params.get('user_id')
        
        if start_date:
            queryset = queryset.filter(created_at__date__gte=parse_date(start_date))
        if end_date:
            queryset = queryset.filter(created_at__date__lte=parse_date(end_date))
            
        # User Filter
        if user_id:
            queryset = queryset.filter(created_by_id=user_id)
            
        return queryset

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        total = qs.count()
        success = qs.filter(status='success').count()
        failed = qs.filter(status='failed').count()
        
        return Response({
            "total_jobs": total,
            "success_rate": f"{(success/total)*100:.1f}%" if total > 0 else "0%",
            "failed": failed
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exports the filtered report as a CSV file.
        """
        import csv
        from django.http import HttpResponse

        qs = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="swim_report.csv"'

        writer = csv.writer(response)
        writer.writerow(['Job ID', 'Device', 'Status', 'Date', 'User'])

        for job in qs:
            user = job.created_by.username if job.created_by else 'System'
            writer.writerow([job.id, job.device.hostname, job.status, job.created_at, user])

        return response
