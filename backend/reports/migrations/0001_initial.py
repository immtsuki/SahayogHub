import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
import reports.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Report",
            fields=[
                ("id", models.CharField(default=reports.models.report_id, editable=False, max_length=64, primary_key=True, serialize=False)),
                ("report_type", models.CharField(choices=[("lost", "Lost"), ("found", "Found")], max_length=12)),
                ("status", models.CharField(blank=True, choices=[("not_found", "Not Found Yet"), ("found", "Found"), ("owner_not_found", "Owner Not Found"), ("owner_found", "Owner Found")], max_length=24)),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
                ("category", models.CharField(blank=True, max_length=80)),
                ("category_label", models.CharField(blank=True, max_length=120)),
                ("location_label", models.CharField(blank=True, max_length=240)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("image_urls", models.JSONField(blank=True, default=list)),
                ("match_percent", models.PositiveSmallIntegerField(default=80)),
                ("contact_name", models.CharField(blank=True, max_length=150)),
                ("contact_email", models.EmailField(blank=True, max_length=254)),
                ("contact_phone", models.CharField(blank=True, max_length=32)),
                ("contact_avatar", models.URLField(blank=True)),
                ("read", models.BooleanField(default=False)),
                ("reported_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reports", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-reported_at", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="report",
            index=models.Index(fields=["report_type", "reported_at"], name="reports_rep_report__a396e7_idx"),
        ),
        migrations.AddIndex(
            model_name="report",
            index=models.Index(fields=["latitude", "longitude"], name="reports_rep_latitud_f7f670_idx"),
        ),
        migrations.AddIndex(
            model_name="report",
            index=models.Index(fields=["category_label"], name="reports_rep_categor_64561e_idx"),
        ),
    ]
