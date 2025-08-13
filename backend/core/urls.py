from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

from faces.views import (
    # Endpoints existentes
    ClassroomCreateView,
    ActivityCreateView,
    EnrollmentView,
    StudentClassroomListView,
    # Nuevos para docente
    TeacherClassroomListView,
    ClassroomDetailView,
    ActivityListView,
    # Para inscribirse a clases
    EnrollByCodeView, 
    StudentActivitiesAllView, 
    StudentActivitiesByClassView,
    StudentUnenrollView, 
    ClassroomStudentsListView, 
    RemoveStudentFromClassView,
    MarkVideoWatchedView, 
    GetQuizView, 
    SubmitQuizView, 
    QuizResultsView,
    # Estadistica de estudiante
    ClassroomRiskView,
    #Para eliminar actividades
    ActivityDetailView
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Endpoints generales de la app faces (login, registro, etc.)
    path("api/", include("faces.urls")),

    # ---- Aulas y actividades ----

    # Crear aula (docente)
    path("api/classroom/create/", ClassroomCreateView.as_view(), name="create_classroom"),

    # Crear actividad (docente)
    path("api/classroom/<int:classroom_id>/activity/create/", ActivityCreateView.as_view(), name="create_activity"),

    # Inscripción de estudiante a un aula
    path("api/classroom/<int:classroom_id>/enroll/", EnrollmentView.as_view(), name="enroll_in_class"),

    # Listar aulas del docente autenticado
    path("api/teacher/classrooms/", TeacherClassroomListView.as_view(), name="teacher_classrooms"),

    # Detalle de un aula (solo si es del docente autenticado)
    path("api/classrooms/<int:classroom_id>/", ClassroomDetailView.as_view(), name="classroom_detail"),

    # Listar actividades de un aula del docente
    path("api/classrooms/<int:classroom_id>/activities/", ActivityListView.as_view(), name="classroom_activities"),

    # Listar aulas del estudiante autenticado
    path("api/student/classrooms/", StudentClassroomListView.as_view(), name="student_classrooms"),

    #Incribirse a una clase
    path("api/student/enroll-by-code/", EnrollByCodeView.as_view(), name="student_enroll_by_code"),
    path("api/student/activities/", StudentActivitiesAllView.as_view(), name="student_activities_all"),
    path("api/student/classrooms/<int:classroom_id>/activities/", StudentActivitiesByClassView.as_view(), name="student_activities_by_class"),

    # Estudiante: darse de baja
    path("api/student/classrooms/<int:classroom_id>/unenroll/", StudentUnenrollView.as_view(), name="student_unenroll"),

    # Docente: lista/remueve estudiantes
    path("api/classrooms/<int:classroom_id>/students/", ClassroomStudentsListView.as_view(), name="classroom_students"),
    path("api/classrooms/<int:classroom_id>/students/<int:student_id>/", RemoveStudentFromClassView.as_view(), name="classroom_remove_student"),

    # alumno: progreso y quiz
    path("api/student/activities/<int:activity_id>/video-watched/", MarkVideoWatchedView.as_view(), name="mark_video_watched"),
    path("api/student/activities/<int:activity_id>/quiz/", GetQuizView.as_view(), name="get_quiz"),
    path("api/student/activities/<int:activity_id>/quiz/submit/", SubmitQuizView.as_view(), name="submit_quiz"),

    # docente: ver resultados del quiz
    path("api/activities/<int:activity_id>/quiz/results/", QuizResultsView.as_view(), name="quiz_results"),

    # Estadistica para datos del estudiante
    path("api/teacher/classrooms/<int:classroom_id>/risk/", ClassroomRiskView.as_view(), name="classroom_risk"),

    #Eliminar una actividad
    path("api/activities/<int:activity_id>/", ActivityDetailView.as_view(), name="activity_detail"),

]

# Servir media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
