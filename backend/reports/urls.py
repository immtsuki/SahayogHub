from django.urls import path

from .views import ReportDetailView, ReportListCreateView, ReportStatsView

urlpatterns = [
    path("", ReportListCreateView.as_view(), name="report-list-create"),
    path("stats/", ReportStatsView.as_view(), name="report-stats"),
    path("<str:pk>/", ReportDetailView.as_view(), name="report-detail"),
]
