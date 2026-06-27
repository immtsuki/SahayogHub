from django.utils import timezone
from rest_framework import serializers

from .models import Report


def _time_ago(value):
    if not value:
        return "Unknown"
    delta = timezone.now() - value
    seconds = max(0, int(delta.total_seconds()))
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hr ago"
    days = hours // 24
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    return f"{weeks}w ago"


class ReportSerializer(serializers.ModelSerializer):
    report_type = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    contact = serializers.JSONField(required=False, write_only=True)
    location = serializers.CharField(source="location_label", required=False, allow_blank=True)
    lat = serializers.FloatField(source="latitude", required=False, allow_null=True)
    lng = serializers.FloatField(source="longitude", required=False, allow_null=True)
    images = serializers.ListField(child=serializers.CharField(), source="image_urls", required=False)
    originalImages = serializers.ListField(
        child=serializers.CharField(),
        source="original_image_urls",
        required=False,
        write_only=True,
    )
    submittedAt = serializers.DateTimeField(source="reported_at", required=False)

    class Meta:
        model = Report
        fields = [
            "id",
            "report_type",
            "subject_type",
            "status",
            "title",
            "description",
            "category",
            "category_label",
            "location",
            "location_label",
            "lat",
            "lng",
            "latitude",
            "longitude",
            "images",
            "image_urls",
            "originalImages",
            "original_image_urls",
            "redacted_image_urls",
            "match_percent",
            "ai_matches",
            "ai_analysis",
            "ai_status",
            "ai_processed_at",
            "contact",
            "read",
            "submittedAt",
            "reported_at",
        ]
        read_only_fields = [
            "read",
            "original_image_urls",
            "redacted_image_urls",
            "ai_matches",
            "ai_analysis",
            "ai_status",
            "ai_processed_at",
        ]

    def validate(self, attrs):
        status = attrs.get("status")
        report_type = attrs.get("report_type")
        if self.instance is None and status in {Report.LOST, Report.FOUND} and not report_type:
            attrs["report_type"] = status
            attrs.pop("status", None)
        if not attrs.get("report_type") and self.instance is None:
            attrs["report_type"] = Report.LOST
        if not attrs.get("subject_type") and self.instance is None:
            attrs["subject_type"] = Report.ITEM
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        contact = validated_data.pop("contact", {}) or {}
        if request and request.user.is_authenticated:
            validated_data["owner"] = request.user
            validated_data.setdefault("contact_name", request.user.full_name)
            validated_data.setdefault("contact_email", request.user.email)
            validated_data.setdefault("contact_phone", request.user.phone or "")
            if request.user.profile_photo:
                validated_data.setdefault("contact_avatar", request.user.profile_photo.url)
        validated_data["contact_name"] = contact.get("name") or contact.get("full_name") or validated_data.get("contact_name", "")
        validated_data["contact_email"] = contact.get("email") or validated_data.get("contact_email", "")
        validated_data["contact_phone"] = contact.get("phone") or validated_data.get("contact_phone", "")
        validated_data["contact_avatar"] = contact.get("avatar") or validated_data.get("contact_avatar", "")
        if not validated_data.get("original_image_urls") and validated_data.get("image_urls"):
            validated_data["original_image_urls"] = list(validated_data["image_urls"])
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        first_image = (instance.image_urls or [""])[0]
        reporter_name = instance.contact_name or (instance.owner.full_name if instance.owner else "Sahayog User")
        reporter_email = instance.contact_email or (instance.owner.email if instance.owner else "")
        reporter_phone = instance.contact_phone or (instance.owner.phone if instance.owner else "")
        reporter_avatar = instance.contact_avatar or f"https://i.pravatar.cc/40?u={reporter_email or instance.id}"

        data.update(
            {
                "status": instance.status,
                "item_status": instance.frontend_status,
                "date": instance.reported_at.strftime("%b %d, %Y"),
                "timeAgo": _time_ago(instance.reported_at),
                "postedAgo": _time_ago(instance.reported_at),
                "location": instance.location_label,
                "lat": instance.latitude,
                "lng": instance.longitude,
                "image": first_image,
                "images": instance.image_urls or [],
                "displayImage": first_image,
                "displayImages": instance.image_urls or [],
                "blurredImages": instance.redacted_image_urls or [],
                "hasOriginalImages": bool(instance.original_image_urls),
                "matchPercent": instance.match_percent,
                "aiMatches": instance.ai_matches or [],
                "hasAiMatches": bool(instance.ai_matches),
                "aiStatus": instance.ai_status,
                "distance": "Pinned location" if instance.latitude is not None and instance.longitude is not None else "No location",
                "user": {
                    "id": str(instance.owner_id or instance.id),
                    "name": reporter_name,
                    "avatar": reporter_avatar,
                    "email": reporter_email,
                    "phone": reporter_phone,
                },
                "contact": {
                    "name": reporter_name,
                    "email": reporter_email,
                    "phone": reporter_phone,
                    "avatar": reporter_avatar,
                },
            }
        )
        return data
