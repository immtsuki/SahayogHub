import uuid
from datetime import timedelta

from django.db import migrations
from django.utils import timezone


def seed_reports(apps, schema_editor):
    Report = apps.get_model("reports", "Report")
    now = timezone.now()
    rows = [
        {
            "id": f"seed-{uuid.uuid5(uuid.NAMESPACE_DNS, 'black-backpack')}",
            "report_type": "lost",
            "status": "not_found",
            "title": "Lost Black Backpack",
            "description": "Left my black Nike backpack near the central park entrance. Has a red keychain and laptop inside.",
            "category": "bags_luggage",
            "category_label": "Bags & Luggage",
            "location_label": "Downtown",
            "latitude": 40.785,
            "longitude": -73.968,
            "image_urls": ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"],
            "match_percent": 92,
            "contact_name": "Maya Chen",
            "contact_email": "maya.chen@gmail.com",
            "contact_phone": "+977 9801112233",
            "reported_at": now - timedelta(minutes=32),
        },
        {
            "id": f"seed-{uuid.uuid5(uuid.NAMESPACE_DNS, 'brown-wallet')}",
            "report_type": "found",
            "status": "owner_not_found",
            "title": "Found Brown Leather Wallet",
            "description": "Found a brown leather wallet by the riverside trail. Contains some cards and cash. Reach out to claim it with identification.",
            "category": "wallet",
            "category_label": "Wallet",
            "location_label": "Riverside",
            "latitude": 40.772,
            "longitude": -73.974,
            "image_urls": ["https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80"],
            "match_percent": 87,
            "contact_name": "Jordan Lee",
            "contact_email": "jordan.lee@gmail.com",
            "contact_phone": "+977 9802223344",
            "reported_at": now - timedelta(hours=2),
        },
        {
            "id": f"seed-{uuid.uuid5(uuid.NAMESPACE_DNS, 'house-keys')}",
            "report_type": "lost",
            "status": "not_found",
            "title": "Lost House Keys",
            "description": "Lost a set of house keys around 5th Ave Station. Has a small blue bottle opener keychain attached. Very important, please contact if found.",
            "category": "keys",
            "category_label": "Keys",
            "location_label": "5th Ave Station",
            "latitude": 40.778,
            "longitude": -73.962,
            "image_urls": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80"],
            "match_percent": 74,
            "contact_name": "Daniel Reyes",
            "contact_email": "daniel.reyes@gmail.com",
            "reported_at": now - timedelta(hours=4),
        },
        {
            "id": f"seed-{uuid.uuid5(uuid.NAMESPACE_DNS, 'round-glasses')}",
            "report_type": "found",
            "status": "owner_found",
            "title": "Round Frame Glasses",
            "description": "Found a pair of round tortoiseshell glasses near the fountain area in Central Park. Prescription lenses, left them at the park security office.",
            "category": "accessories",
            "category_label": "Accessories",
            "location_label": "Central Park",
            "latitude": 40.762,
            "longitude": -73.98,
            "image_urls": ["https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&q=80"],
            "match_percent": 68,
            "contact_name": "Ava Patel",
            "contact_email": "ava.patel@gmail.com",
            "contact_phone": "+977 9803334455",
            "reported_at": now - timedelta(days=1),
        },
    ]
    for row in rows:
        Report.objects.update_or_create(id=row["id"], defaults={k: v for k, v in row.items() if k != "id"})


def unseed_reports(apps, schema_editor):
    Report = apps.get_model("reports", "Report")
    Report.objects.filter(id__startswith="seed-").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_reports, unseed_reports),
    ]
