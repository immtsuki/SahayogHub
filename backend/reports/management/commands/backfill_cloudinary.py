"""
Management command: backfill_cloudinary

Finds all Report records whose image_urls / original_image_urls /
redacted_image_urls contain raw base64 data URLs and uploads them to
Cloudinary, replacing the data URL with the returned secure HTTPS URL.

Usage:
    python manage.py backfill_cloudinary
    python manage.py backfill_cloudinary --dry-run   # preview only, no writes
    python manage.py backfill_cloudinary --batch 50  # process N reports at a time
"""

import cloudinary
import cloudinary.uploader
from django.conf import settings
from django.core.management.base import BaseCommand

from reports.models import Report


def _configure_cloudinary():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _is_base64(url: str) -> bool:
    return url.startswith("data:image/")


def _is_remote(url: str) -> bool:
    return url.startswith("http://") or url.startswith("https://")


def _upload(data_url: str, report_id: str, field: str, index: int) -> str:
    """Upload a single base64 data URL and return the Cloudinary secure URL."""
    result = cloudinary.uploader.upload(
        data_url,
        folder="sahayog_reports",
        public_id=f"{report_id}_{field}_{index}",
        overwrite=False,
        resource_type="image",
    )
    return result["secure_url"]


def _migrate_list(urls: list, report_id: str, field: str, dry_run: bool) -> tuple[list, int]:
    """
    Returns (new_urls, upload_count).
    Skips URLs that are already remote.
    """
    new_urls = []
    count = 0
    for i, url in enumerate(urls):
        if _is_base64(url):
            if dry_run:
                new_urls.append(f"[WOULD UPLOAD index={i}]")
                count += 1
            else:
                secure_url = _upload(url, report_id, field, i)
                new_urls.append(secure_url)
                count += 1
        else:
            new_urls.append(url)
    return new_urls, count


class Command(BaseCommand):
    help = "Migrate base64 image_urls in Report records to Cloudinary URLs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview changes without writing to the database",
        )
        parser.add_argument(
            "--batch",
            type=int,
            default=100,
            help="Number of reports to process per batch (default: 100)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        batch_size = options["batch"]

        if not settings.CLOUDINARY_CLOUD_NAME:
            self.stderr.write(self.style.ERROR(
                "CLOUDINARY_CLOUD_NAME is not set. Add it to your .env file."
            ))
            return

        _configure_cloudinary()

        self.stdout.write(
            self.style.WARNING("DRY RUN — no changes will be saved.\n")
            if dry_run
            else self.style.SUCCESS("Starting Cloudinary backfill migration...\n")
        )

        total_reports = 0
        total_uploads = 0
        offset = 0

        while True:
            batch = list(Report.objects.all()[offset: offset + batch_size])
            if not batch:
                break

            for report in batch:
                changed = False
                uploads_this_report = 0

                for field in ("image_urls", "original_image_urls", "redacted_image_urls"):
                    urls = getattr(report, field) or []
                    if not any(_is_base64(u) for u in urls):
                        continue

                    new_urls, count = _migrate_list(urls, report.id, field, dry_run)
                    uploads_this_report += count

                    if not dry_run:
                        setattr(report, field, new_urls)
                        changed = True

                if uploads_this_report > 0:
                    total_reports += 1
                    total_uploads += uploads_this_report
                    self.stdout.write(
                        f"  {'[DRY] ' if dry_run else ''}Report {report.id}: "
                        f"{uploads_this_report} image(s) {'would be ' if dry_run else ''}uploaded"
                    )

                if changed:
                    report.save(update_fields=["image_urls", "original_image_urls", "redacted_image_urls"])

            offset += batch_size

        self.stdout.write("\n" + self.style.SUCCESS(
            f"Done. {total_uploads} image(s) across {total_reports} report(s) "
            f"{'would be ' if dry_run else ''}migrated to Cloudinary."
        ))
