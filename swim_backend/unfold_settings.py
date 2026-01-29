# Unfold Admin Theme Configuration
UNFOLD = {
    "SITE_TITLE": "SWIM Admin",
    "SITE_HEADER": "SWIM - Software Image Management",
    "SITE_URL": "/",
    "DASHBOARD_CALLBACK": "swim_backend.urls.dashboard_callback",
    "STYLES": [
        lambda request: "/static/custom_admin.css",
    ],
    "COLORS": {
        "primary": {
            "50": "239 246 255",
            "100": "219 234 254",
            "200": "191 219 254",
            "300": "147 197 253",
            "400": "96 165 250",
            "500": "59 130 246",
            "600": "37 99 235",
            "700": "29 78 216",
            "800": "30 64 175",
            "900": "30 58 138",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": "Dashboard",
                "separator": False,
                "items": [
                    {
                        "title": "Dashboard",
                        "icon": "dashboard",
                        "link": "/admin/",
                    },
                ],
            },
            {
                "title": "Inventory",
                "separator": True,
                "items": [
                    {
                        "title": "Devices",
                        "icon": "devices",
                        "link": "/admin/devices/device/",
                    },
                    {
                        "title": "Device Models",
                        "icon": "category",
                        "link": "/admin/devices/devicemodel/",
                    },
                    {
                        "title": "Sites",
                        "icon": "location_on",
                        "link": "/admin/devices/site/",
                    },
                    {
                        "title": "Regions",
                        "icon": "public",
                        "link": "/admin/devices/region/",
                    },
                ],
            },
            {
                "title": "Software Images",
                "separator": True,
                "items": [
                    {
                        "title": "Images",
                        "icon": "storage",
                        "link": "/admin/images/image/",
                    },
                    {
                        "title": "File Servers",
                        "icon": "dns",
                        "link": "/admin/images/fileserver/",
                    },
                ],
            },
            {
                "title": "Jobs & Workflows",
                "separator": True,
                "items": [
                    {
                        "title": "Jobs",
                        "icon": "work",
                        "link": "/admin/core/job/",
                    },
                    {
                        "title": "Workflows",
                        "icon": "account_tree",
                        "link": "/admin/core/workflow/",
                    },
                    {
                        "title": "Validation Checks",
                        "icon": "check_circle",
                        "link": "/admin/core/validationcheck/",
                    },
                ],
            },
            {
                "title": "System",
                "separator": True,
                "items": [
                    {
                        "title": "Users",
                        "icon": "person",
                        "link": "/admin/auth/user/",
                    },
                    {
                        "title": "Groups",
                        "icon": "group",
                        "link": "/admin/auth/group/",
                    },
                    {
                        "title": "Activity Logs",
                        "icon": "history",
                        "link": "/admin/core/activitylog/",
                    },
                ],
            },
        ],
    },
}
