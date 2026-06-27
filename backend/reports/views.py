from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Report
from .serializers import ReportSerializer
from .ai import process_report_ai


class ReportListCreateView(generics.ListCreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Report.objects.select_related("owner").all()
        params = self.request.query_params

        report_type = params.get("type") or params.get("report_type")
        if report_type in {Report.LOST, Report.FOUND}:
            qs = qs.filter(report_type=report_type)

        status_filter = params.get("status")
        if status_filter:
            normalized = status_filter.lower()
            if normalized in {"lost", "found"}:
                qs = qs.filter(report_type=normalized)
            elif normalized not in {"all", "nearby", "recent"}:
                qs = qs.filter(status=normalized)

        q = params.get("q") or params.get("query")
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(category_label__icontains=q)
                | Q(location_label__icontains=q)
            )

        category = params.get("category")
        if category:
            categories = [c.strip() for c in category.split(",") if c.strip()]
            qs = qs.filter(category_label__in=categories)

        location = params.get("location")
        if location:
            qs = qs.filter(location_label__icontains=location)

        ids = params.get("ids")
        if ids:
            qs = qs.filter(id__in=[i.strip() for i in ids.split(",") if i.strip()])

        mine = params.get("mine")
        if mine == "true":
            if self.request.user.is_authenticated:
                qs = qs.filter(owner=self.request.user)
            else:
                qs = qs.none()

        if params.get("recent") == "true":
            qs = qs.order_by("-reported_at")[:10]

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        report = serializer.instance
        process_report_ai(report)
        output = self.get_serializer(report)
        return Response(output.data, status=status.HTTP_201_CREATED)


class ReportDetailView(generics.RetrieveUpdateAPIView):
    queryset = Report.objects.select_related("owner").all()
    serializer_class = ReportSerializer
    permission_classes = [AllowAny]

    def patch(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class ReportStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lost = Report.objects.filter(report_type=Report.LOST).count()
        found = Report.objects.filter(report_type=Report.FOUND).count()
        recoveries = Report.objects.filter(status__in=[Report.FOUND_STATUS, Report.OWNER_FOUND]).count()

        grouped = (
            Report.objects.exclude(contact_email="")
            .values("contact_name", "contact_email", "contact_avatar")
            .annotate(total=Count("id"))
            .order_by("-total", "contact_name")[:3]
        )

        members = []
        for index, row in enumerate(grouped, start=1):
            email = row["contact_email"]
            name = row["contact_name"] or email.split("@")[0]
            members.append(
                {
                    "id": email,
                    "name": name,
                    "avatar": row["contact_avatar"] or f"https://i.pravatar.cc/40?u={email}",
                    "trustScore": min(99, 82 + row["total"] * 4),
                    "rank": index,
                }
            )

        return Response(
            {
                "quickStats": {
                    "lost": lost,
                    "found": found,
                    "recoveries": recoveries,
                },
                "communityMembers": members,
            }
        )
