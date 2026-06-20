from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("title", "report_type", "status", "category_label", "location_label", "reported_at")
    list_filter = ("report_type", "status", "category_label")
    search_fields = ("title", "description", "location_label", "contact_name", "contact_email")
