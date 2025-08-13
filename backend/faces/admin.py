from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, FaceRecord

class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ("username", "email", "role", "codigo", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    fieldsets = (
        (None, {"fields": ("username", "email", "password", "role", "codigo")}),
        ("Permissions", {"fields": ("is_staff", "is_active", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "email", "password1", "password2", "role", "codigo", "is_staff", "is_active")}
        ),
    )
    search_fields = ("username", "email", "role", "codigo")
    ordering = ("username",)

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(FaceRecord)
