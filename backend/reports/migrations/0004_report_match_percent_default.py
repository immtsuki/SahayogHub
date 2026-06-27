from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0003_report_ai_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="report",
            name="match_percent",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
