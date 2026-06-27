import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def report_id():
    return f"r-{uuid.uuid4()}"


class Report(models.Model):
    LOST = "lost"
    FOUND = "found"
    REPORT_TYPE_CHOICES = (
        (LOST, "Lost"),
        (FOUND, "Found"),
    )

    NOT_FOUND = "not_found"
    FOUND_STATUS = "found"
    OWNER_NOT_FOUND = "owner_not_found"
    OWNER_FOUND = "owner_found"
    STATUS_CHOICES = (
        (NOT_FOUND, "Not Found Yet"),
        (FOUND_STATUS, "Found"),
        (OWNER_NOT_FOUND, "Owner Not Found"),
        (OWNER_FOUND, "Owner Found"),
    )

    ITEM = "item"
    HUMAN = "human"
    DOCUMENT = "document"
    SUBJECT_TYPE_CHOICES = (
        (ITEM, "Item"),
        (HUMAN, "Person"),
        (DOCUMENT, "Document"),
    )

    id = models.CharField(max_length=64, primary_key=True, default=report_id, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reports",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    report_type = models.CharField(max_length=12, choices=REPORT_TYPE_CHOICES)
    subject_type = models.CharField(max_length=24, choices=SUBJECT_TYPE_CHOICES, default=ITEM)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, blank=True)
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80, blank=True)
    category_label = models.CharField(max_length=120, blank=True)
    location_label = models.CharField(max_length=240, blank=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    image_urls = models.JSONField(default=list, blank=True)
    original_image_urls = models.JSONField(default=list, blank=True)
    redacted_image_urls = models.JSONField(default=list, blank=True)
    match_percent = models.PositiveSmallIntegerField(default=0)
    ai_matches = models.JSONField(default=list, blank=True)
    ai_analysis = models.JSONField(default=dict, blank=True)
    ai_status = models.CharField(max_length=32, blank=True)
    ai_processed_at = models.DateTimeField(blank=True, null=True)

    contact_name = models.CharField(max_length=150, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    contact_avatar = models.URLField(blank=True)

    read = models.BooleanField(default=False)
    reported_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-reported_at", "-created_at"]
        indexes = [
            models.Index(fields=["report_type", "reported_at"]),
            models.Index(fields=["subject_type", "reported_at"]),
            models.Index(fields=["latitude", "longitude"]),
            models.Index(fields=["category_label"]),
        ]

    def save(self, *args, **kwargs):
        if not self.status:
            self.status = self.NOT_FOUND if self.report_type == self.LOST else self.OWNER_NOT_FOUND
        if not self.subject_type:
            self.subject_type = self.ITEM
        if not self.category_label and self.category:
            self.category_label = self.category.replace("_", " ").title()
        if not self.original_image_urls and self.image_urls:
            self.original_image_urls = list(self.image_urls)
        super().save(*args, **kwargs)

    @property
    def frontend_status(self):
        return "LOST" if self.report_type == self.LOST else "FOUND"

    @property
    def is_recovered(self):
        return self.status in {self.FOUND_STATUS, self.OWNER_FOUND}

    def __str__(self):
        return f"{self.get_report_type_display()}: {self.title}"
