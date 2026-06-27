from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0002_seed_reports"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="subject_type",
            field=models.CharField(
                choices=[
                    ("item", "Item"),
                    ("human", "Person"),
                    ("document", "Document"),
                ],
                default="item",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="report",
            name="original_image_urls",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="report",
            name="redacted_image_urls",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="report",
            name="ai_matches",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="report",
            name="ai_analysis",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="report",
            name="ai_status",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="report",
            name="ai_processed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="report",
            index=models.Index(fields=["subject_type", "reported_at"], name="reports_rep_subject_c2e2d6_idx"),
        ),
    ]
