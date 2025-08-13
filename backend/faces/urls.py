from django.urls import path
from .views import SaveFaceRecord, emotion_summary, RegisterUser, LoginUser, GetLabeledImages

urlpatterns = [
    path("save/", SaveFaceRecord.as_view()),
    path("emotion-summary/", emotion_summary),
    path("register/", RegisterUser.as_view()),
    path("login/", LoginUser.as_view()),
    path("get-labeled-images/", GetLabeledImages.as_view(), name="get-labeled-images"),
]
