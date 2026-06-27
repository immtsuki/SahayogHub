"""
Management command to fill missing descriptions on Report records.

Usage:
    python manage.py fill_descriptions          # preview only
    python manage.py fill_descriptions --save   # apply changes
"""

from django.core.management.base import BaseCommand

from reports.models import Report

FALLBACKS: dict[str, str] = {
    # item / bags
    "bag":        "A bag was reported. No further details were provided at the time of submission.",
    "backpack":   "A backpack was reported. No further details were provided at the time of submission.",
    "luggage":    "Luggage was reported. No further details were provided at the time of submission.",
    # electronics
    "phone":      "A mobile phone was reported. No further details were provided at the time of submission.",
    "laptop":     "A laptop was reported. No further details were provided at the time of submission.",
    "tablet":     "A tablet/iPad was reported. No further details were provided at the time of submission.",
    "airpods":    "Wireless earbuds were reported. No further details were provided at the time of submission.",
    "earphone":   "Earphones were reported. No further details were provided at the time of submission.",
    "camera":     "A camera was reported. No further details were provided at the time of submission.",
    # documents
    "passport":   "A passport was reported. Personal details have been redacted for privacy.",
    "id card":    "An ID card was reported. Personal details have been redacted for privacy.",
    "document":   "A document was reported. No further details were provided at the time of submission.",
    "certificate":"A certificate was reported. No further details were provided at the time of submission.",
    # keys / wallet
    "key":        "A set of keys was reported. No further details were provided at the time of submission.",
    "wallet":     "A wallet was reported. No further details were provided at the time of submission.",
    # clothing
    "jacket":     "A jacket was reported. No further details were provided at the time of submission.",
    "shirt":      "A clothing item was reported. No further details were provided at the time of submission.",
    "glasses":    "A pair of glasses was reported. No further details were provided at the time of submission.",
    "watch":      "A watch was reported. No further details were provided at the time of submission.",
    # vehicle
    "vehicle":    "A vehicle was reported. No further details were provided at the time of submission.",
    "car":        "A car was reported. No further details were provided at the time of submission.",
    "bike":       "A bike was reported. No further details were provided at the time of submission.",
    "motorcycle": "A motorcycle was reported. No further details were provided at the time of submission.",
    # pets
    "dog":        "A dog was reported. No further details were provided at the time of submission.",
    "cat":        "A cat was reported. No further details were provided at the time of submission.",
    "pet":        "A pet was reported. No further details were provided at the time of submission.",
    # person
    "person":     "A person was reported. No further details were provided at the time of submission.",
    "child":      "A child was reported missing. No further details were provided at the time of submission.",
    "adult":      "An adult was reported. No further details were provided at the time of submission.",
}

DEFAULT_LOST  = "This item was reported lost. No further description was provided at the time of submission. Please contact the reporter for more details."
DEFAULT_FOUND = "This item was reported found. No further description was provided at the time of submission. Please contact the finder for more details."


def _choose_description(report: Report) -> str:
    title_lower = report.title.lower()
    for keyword, text in FALLBACKS.items():
        if keyword in title_lower:
            return text
    cat = (report.category_label or report.category or "").lower()
    for keyword, text in FALLBACKS.items():
        if keyword in cat:
            return text
    return DEFAULT_LOST if report.report_type == Report.LOST else DEFAULT_FOUND


class Command(BaseCommand):
    help = "Fill blank descriptions on Report records with sensible fallback text."

    def add_arguments(self, parser):
        parser.add_argument(
            "--save",
            action="store_true",
            help="Actually save changes (default is dry-run/preview only).",
        )

    def handle(self, *args, **options):
        save = options["save"]
        empty_qs = Report.objects.filter(description="")
        count = empty_qs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("✔  No reports with empty descriptions found."))
            return

        self.stdout.write(f"Found {count} report(s) with empty description.")

        updated = 0
        for report in empty_qs.iterator():
            new_desc = _choose_description(report)
            self.stdout.write(f"  [{report.id[:20]}] {report.title!r}")
            self.stdout.write(f"    → {new_desc[:80]}...")
            if save:
                report.description = new_desc
                report.save(update_fields=["description", "updated_at"])
                updated += 1

        if save:
            self.stdout.write(self.style.SUCCESS(f"\n✔  Updated {updated} record(s)."))
        else:
            self.stdout.write(self.style.WARNING(
                f"\nDry-run complete. Re-run with --save to apply changes."
            ))
