from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.decorators import api_view
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from collections import Counter, defaultdict
from django.utils import timezone
from .models import FaceRecord, CustomUser, Classroom, Activity, Enrollment, ActivityProgress, QuizSubmission, Question, SubmissionAnswer, Quiz, Option
from .serializers import (
    UserCreateSerializer,
    ClassroomSerializer,
    ActivitySerializer,
    EnrollmentSerializer,
    Option,
    Question,
    QuizPublicSerializer,
    QuizCreateSerializer,
    Activity,
    Quiz,
)

# -------------------------------
# Utilidades
# -------------------------------

# Códigos válidos para cada rol (estáticos)
CODES = {
    "estudiante": ["EST001", "EST002", "EST003", "EST004", "EST005"],
    "docente": ["DOC001", "DOC002", "DOC003", "DOC004", "DOC005"],
}

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}

# -------------------------------
# Face records y resumen
# -------------------------------

# faces/views.py
class SaveFaceRecord(APIView):
    def post(self, request):
        name = (request.data.get("name") or "").strip()
        emotion = (request.data.get("emotion") or "").strip()
        activity_id = request.data.get("activity_id")
        phase = request.data.get("phase")  # "video" | "quiz"

        if not name or not emotion:
            return Response({"error": "Faltan datos"}, status=status.HTTP_400_BAD_REQUEST)

        # No guardar si es "Desconocido"/"unknown"
        if name.lower() in {"desconocido", "unknown"}:
            # 204 = No Content; no se guarda nada
            return Response(status=status.HTTP_204_NO_CONTENT)

        user = CustomUser.objects.filter(username=name).first()
        activity = Activity.objects.filter(id=activity_id).first() if activity_id else None

        FaceRecord.objects.create(
            name=name,
            emotion=emotion,
            user=user,
            activity=activity,
            phase=phase if phase in ("video", "quiz") else None,
        )

        return Response({"message": "Registro guardado"}, status=status.HTTP_201_CREATED)



@api_view(['GET'])
def emotion_summary(request):
    records = FaceRecord.objects.all()

    emotion_scores = {
        "happy": 1, "surprised": 1, "neutral": 0,
        "angry": -1, "sad": -1, "fearful": -1, "disgusted": -1,
    }

    summary_scores = defaultdict(int)
    emotion_counts = defaultdict(lambda: defaultdict(int))
    total_counts = defaultdict(int)

    for record in records:
        summary_scores[record.name] += emotion_scores.get(record.emotion, 0)
        emotion_counts[record.name][record.emotion] += 1
        total_counts[record.name] += 1

    result = []
    for name in summary_scores:
        score = summary_scores[name]
        risk = "🔴 Alto riesgo" if score <= -2 else ("🟡 Riesgo medio" if score <= 0 else "🟢 Bajo riesgo")
        result.append({
            "name": name,
            "risk": risk,
            "total_detections": total_counts[name],
            "emotions": emotion_counts[name],
        })
    return Response(result)

# -------------------------------
# Auth
# -------------------------------

class RegisterUser(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")
        codigo = data.get("codigo")
        cedula = data.get("cedula")

        if not all([username, email, password, role, codigo, cedula]):
            return Response({"error": "Faltan datos"}, status=status.HTTP_400_BAD_REQUEST)

        if role not in CODES or codigo not in CODES[role]:
            return Response({"error": "Código inválido para el rol seleccionado"}, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(username=username).exists():
            return Response({"error": "Usuario ya existe"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UserCreateSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Usuario registrado correctamente"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginUser(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)
        if user is None:
            return Response({"error": "Credenciales inválidas"}, status=status.HTTP_400_BAD_REQUEST)

        tokens = get_tokens_for_user(user)
        return Response({
            "message": "Login exitoso",
            "role": user.role,
            "username": user.username,
            "token": tokens["access"],        # para el frontend
            "refresh": tokens["refresh"],     # por si luego usas refresh
        }, status=status.HTTP_200_OK)

# Solo estudiantes con imagen (dataset para reconocimiento)
class GetLabeledImages(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        users = CustomUser.objects.filter(role="estudiante")
        data = []
        for u in users:
            data.append({
                "username": u.username,
                "image": (request.build_absolute_uri(u.image.url) if u.image else None)
            })
        return Response(data, status=200)

# -------------------------------
# Classroom / Activity / Enrollment
# -------------------------------

# Crear clase (docente)
class ClassroomCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != 'docente':
            return Response({"error": "Only teachers can create classrooms"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ClassroomSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            classroom = serializer.save(teacher=request.user)
            return Response(ClassroomSerializer(classroom, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Crear actividad (docente)
class ActivityCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Only the teacher of the classroom can create activities"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ActivitySerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        activity = serializer.save(classroom=classroom)

        # Si es Video+Quiz, crear quiz anidado
        if serializer.validated_data.get('type') == 'VIDEO_QUIZ':
            quiz_payload = request.data.get('quiz')
            if quiz_payload:
                qser = QuizCreateSerializer(data=quiz_payload)
                if qser.is_valid():
                    qser.save(activity=activity)
                else:
                    activity.delete()  # rollback simple
                    return Response({"quiz": qser.errors}, status=400)

        return Response(ActivitySerializer(activity, context={"request": request}).data, status=201)

#Eliminar una actividad
class ActivityDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, activity_id):
        activity = get_object_or_404(Activity, id=activity_id)
        # Solo el docente dueño del aula puede borrar
        if request.user.role != "docente" or activity.classroom.teacher_id != request.user.id:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        activity.delete()  # CASCADE borrará quiz, preguntas, opciones, submissions, etc.
        return Response(status=status.HTTP_204_NO_CONTENT)

# Marcar video como visto

class MarkVideoWatchedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, activity_id):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=403)

        activity = get_object_or_404(Activity, id=activity_id)
        # Debe pertenecer a un aula en la que esté inscrito
        if not Enrollment.objects.filter(student=request.user, classroom=activity.classroom).exists():
            return Response({"error": "Not enrolled in this classroom"}, status=403)

        prog, _ = ActivityProgress.objects.get_or_create(activity=activity, student=request.user)
        prog.video_watched = True
        prog.unlocked_at = timezone.now()
        prog.save()
        return Response({"message": "Video marcado como visto, examen desbloqueado."}, status=200)
    
# Obtener Quiz
class GetQuizView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, activity_id):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=403)

        activity = get_object_or_404(Activity, id=activity_id)

        if activity.type != "VIDEO_QUIZ" or not hasattr(activity, 'quiz'):
            return Response({"error": "This activity has no quiz"}, status=404)

        # Debe estar inscrito
        if not Enrollment.objects.filter(student=request.user, classroom=activity.classroom).exists():
            return Response({"error": "Not enrolled"}, status=403)

        # Debe haber visto el video
        if not ActivityProgress.objects.filter(activity=activity, student=request.user, video_watched=True).exists():
            return Response({"error": "Quiz locked. Watch the video first."}, status=403)

        # Cargar el quiz asociado a esta actividad con preguntas/opciones ordenadas
        quiz = (
            Quiz.objects.filter(activity=activity)
            .prefetch_related(
                Prefetch(
                    'questions',
                    queryset=Question.objects.order_by('order').prefetch_related('options')
                )
            )
            .first()
        )

        if not quiz:
            return Response({"error": "Quiz not found"}, status=404)

        submitted = QuizSubmission.objects.filter(quiz=quiz, student=request.user).exists()
        data = QuizPublicSerializer(quiz).data
        data["already_submitted"] = submitted
        return Response(data, status=200)

# Enviar las Respuestas del alumno

class SubmitQuizView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, activity_id):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=403)

        activity = get_object_or_404(Activity, id=activity_id)

        if activity.type != "VIDEO_QUIZ" or not hasattr(activity, 'quiz'):
            return Response({"error": "This activity has no quiz"}, status=404)

        # Inscripción + video visto
        if not Enrollment.objects.filter(student=request.user, classroom=activity.classroom).exists():
            return Response({"error": "Not enrolled"}, status=403)
        if not ActivityProgress.objects.filter(activity=activity, student=request.user, video_watched=True).exists():
            return Response({"error": "Quiz locked. Watch the video first."}, status=403)

        quiz = activity.quiz

        # Un solo intento
        if QuizSubmission.objects.filter(quiz=quiz, student=request.user).exists():
            return Response({"error": "You already submitted this quiz."}, status=400)

        answers = request.data.get("answers", [])
        # Calcular puntaje
        total = quiz.questions.count()
        correct = 0
        chosen_by_qid = {a.get("question"): a.get("option") for a in answers}

        for q in quiz.questions.all():
            chosen = chosen_by_qid.get(q.id)
            if chosen and Option.objects.filter(id=chosen, question=q, is_correct=True).exists():
                correct += 1

        score = (correct / total * 100.0) if total else 0.0
        submission = QuizSubmission.objects.create(quiz=quiz, student=request.user, score=score)

        # Guardar respuestas (opcional pero útil)
        to_create = []
        for q in quiz.questions.all():
            chosen = chosen_by_qid.get(q.id)
            if chosen:
                opt = Option.objects.filter(id=chosen, question=q).first()
                if opt:
                    to_create.append(SubmissionAnswer(
                        submission=submission,
                        question=q,
                        option=opt,
                        is_correct=opt.is_correct
                    ))
        if to_create:
            SubmissionAnswer.objects.bulk_create(to_create)

        return Response({"score": score, "correct": correct, "total": total}, status=201)

# Resultado para el Docente

class QuizResultsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, activity_id):
        activity = get_object_or_404(Activity, id=activity_id)
        if activity.classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        if not hasattr(activity, 'quiz'):
            return Response({"error": "No quiz for this activity"}, status=404)

        subs = activity.quiz.submissions.select_related("student").all()
        data = [{"student": s.student.username, "score": s.score, "submitted_at": s.submitted_at} for s in subs]
        return Response(data, status=200)


# Inscripción (estudiante)
class EnrollmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)

        if request.user.role != "estudiante":
            return Response({"error": "Only students can enroll in classrooms"}, status=status.HTTP_403_FORBIDDEN)

        if Enrollment.objects.filter(student=request.user, classroom=classroom).exists():
            return Response({"error": "Already enrolled in this classroom"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = Enrollment.objects.create(student=request.user, classroom=classroom)
        return Response(EnrollmentSerializer(enrollment, context={"request": request}).data, status=status.HTTP_201_CREATED)

#
class EnrollByCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != "estudiante":
            return Response({"error": "Only students can enroll"}, status=status.HTTP_403_FORBIDDEN)

        code = (request.data.get("code") or "").strip().upper()
        if not code:
            return Response({"error": "code is required"}, status=status.HTTP_400_BAD_REQUEST)

        classroom = get_object_or_404(Classroom, code=code)

        if Enrollment.objects.filter(student=request.user, classroom=classroom).exists():
            return Response({"error": "Already enrolled"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = Enrollment.objects.create(student=request.user, classroom=classroom)
        data = {
            "message": "Enrolled successfully",
            "classroom": ClassroomSerializer(classroom, context={"request": request}).data,
            "enrollment": EnrollmentSerializer(enrollment, context={"request": request}).data,
        }
        return Response(data, status=status.HTTP_201_CREATED)

# Aulas del estudiante autenticado (por sus inscripciones)
class StudentClassroomListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        enrollments = Enrollment.objects.filter(student=request.user).select_related("classroom")
        classrooms = [e.classroom for e in enrollments]
        return Response(ClassroomSerializer(classrooms, many=True, context={"request": request}).data)

class StudentActivitiesAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        classrooms = Enrollment.objects.filter(student=request.user).values_list("classroom_id", flat=True)
        activities = Activity.objects.filter(classroom_id__in=classrooms).order_by("due_date")
        return Response(ActivitySerializer(activities, many=True, context={"request": request}).data, status=status.HTTP_200_OK)


class StudentActivitiesByClassView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, classroom_id):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Solo permitir si está inscrito
        if not Enrollment.objects.filter(student=request.user, classroom_id=classroom_id).exists():
            return Response({"error": "Not enrolled in this classroom"}, status=status.HTTP_403_FORBIDDEN)

        activities = Activity.objects.filter(classroom_id=classroom_id).order_by("due_date")
        return Response(ActivitySerializer(activities, many=True, context={"request": request}).data, status=status.HTTP_200_OK)

class StudentUnenrollView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, classroom_id):
        if request.user.role != "estudiante":
            return Response({"error": "Forbidden"}, status=403)
        enrollment = Enrollment.objects.filter(student=request.user, classroom_id=classroom_id).first()
        if not enrollment:
            return Response({"error": "Not enrolled"}, status=404)
        enrollment.delete()
        return Response(status=204)


# -------------- NUEVOS ENDPOINTS PARA EL DOCENTE --------------

# Listar aulas del docente autenticado
class TeacherClassroomListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "docente":
            return Response({"error": "Only teachers can list their classrooms"}, status=status.HTTP_403_FORBIDDEN)

        classrooms = Classroom.objects.filter(teacher=request.user).order_by("-id")
        data = ClassroomSerializer(classrooms, many=True, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)


# Detalle de aula (docente owner)
class ClassroomDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        return Response(ClassroomSerializer(classroom, context={"request": request}).data, status=status.HTTP_200_OK)
    
    def delete(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        classroom.delete()
        return Response(status=204)
    
    def patch(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        serializer = ClassroomSerializer(classroom, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)

    def put(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        serializer = ClassroomSerializer(classroom, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)



# Listar actividades de un aula del docente
class ActivityListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        activities = Activity.objects.filter(classroom=classroom).order_by("-id")
        data = ActivitySerializer(activities, many=True, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)
    
class ClassroomStudentsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, classroom_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        enrolls = Enrollment.objects.filter(classroom=classroom).select_related("student")
        from .serializers import UserPublicSerializer
        students = [e.student for e in enrolls]
        return Response(UserPublicSerializer(students, many=True, context={"request": request}).data, status=200)


class RemoveStudentFromClassView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, classroom_id, student_id):
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if classroom.teacher != request.user:
            return Response({"error": "Forbidden"}, status=403)
        enrollment = Enrollment.objects.filter(classroom=classroom, student_id=student_id).first()
        if not enrollment:
            return Response({"error": "Enrollment not found"}, status=404)
        enrollment.delete()
        return Response(status=204)

# Reporte por estudiante
class ClassroomRiskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, classroom_id):
        # Solo docente dueño del aula
        classroom = get_object_or_404(Classroom, id=classroom_id)
        if request.user.role != "docente" or classroom.teacher_id != request.user.id:
            return Response({"error": "Forbidden"}, status=403)

        # Alumnos inscritos
        enrollments = Enrollment.objects.filter(classroom=classroom).select_related('student')
        students = [e.student for e in enrollments]

        # Actividades de la clase (trae el quiz en 1 query)
        acts = list(
            classroom.activities.all().select_related("quiz")
        )

        EMOTION_SCORES = {
            "happy": 1, "surprised": 1, "neutral": 0,
            "angry": -1, "sad": -1, "fearful": -1, "disgusted": -1,
        }

        def summarize(records_qs):
            """
            counts: conteo por emoción
            total: total de registros
            risk_index: promedio ponderado [-1,1]
            risk_label: texto del riesgo
            """
            counts = Counter(records_qs.values_list('emotion', flat=True))
            total = sum(counts.values())
            score_sum = sum(EMOTION_SCORES.get(e, 0) * n for e, n in counts.items())
            risk_index = (score_sum / total) if total > 0 else 0.0

            if risk_index <= -0.4:
                risk_label = "🔴 Alto riesgo"
            elif risk_index < 0.2:
                risk_label = "🟡 Riesgo medio"
            else:
                risk_label = "🟢 Bajo riesgo"

            return {
                "counts": dict(counts),
                "total": total,
                "risk_index": round(risk_index, 3),
                "risk_label": risk_label,
            }

        result = {
            "classroom": {
                "id": classroom.id,
                "name": classroom.name,
                "description": classroom.description,
                "code": getattr(classroom, 'code', None),
            },
            "students": [],
        }

        for stu in students:
            stu_entry = {
                "id": stu.id,
                "username": stu.username,
                "email": stu.email,
                "activities": [],
            }

            for a in acts:
                # Resúmenes por fase
                video_qs = FaceRecord.objects.filter(activity=a, user=stu, phase="video")
                quiz_qs  = FaceRecord.objects.filter(activity=a, user=stu, phase="quiz")

                video_sum = summarize(video_qs)
                quiz_sum  = summarize(quiz_qs)

                # Riesgo global de la actividad (video + quiz)
                combined_counts = Counter(video_sum["counts"]) + Counter(quiz_sum["counts"])
                total = sum(combined_counts.values())
                score_sum = sum(EMOTION_SCORES.get(e, 0) * n for e, n in combined_counts.items())
                risk_index = (score_sum / total) if total > 0 else 0.0
                if risk_index <= -0.4:
                    overall_label = "🔴 Alto riesgo"
                elif risk_index < 0.2:
                    overall_label = "🟡 Riesgo medio"
                else:
                    overall_label = "🟢 Bajo riesgo"
                overall_sum = {
                    "counts": dict(combined_counts),
                    "total": total,
                    "risk_index": round(risk_index, 3),
                    "risk_label": overall_label,
                }

                # Nota del quiz (si existe y si el alumno lo envió)
                score = None
                submitted_at = None
                quiz_obj = getattr(a, "quiz", None)
                if quiz_obj is None:
                    try:
                        quiz_obj = Quiz.objects.get(activity=a)
                    except Quiz.DoesNotExist:
                        quiz_obj = None

                if quiz_obj:
                    last_sub = (
                        QuizSubmission.objects
                        .filter(quiz=quiz_obj, student=stu)
                        .order_by("-submitted_at")
                        .first()
                    )
                    if last_sub:
                        score = float(last_sub.score)
                        submitted_at = last_sub.submitted_at

                stu_entry["activities"].append({
                    "id": a.id,
                    "title": a.title,
                    "type": a.type,
                    "video": video_sum,
                    "quiz": quiz_sum,
                    "overall_risk": overall_sum,
                    "grade": score,            # None si no hay entrega
                    "graded_at": submitted_at, # None si no hay entrega
                })

            # Riesgo global del estudiante (todas sus actividades)
            all_counts = Counter()
            for actrep in stu_entry["activities"]:
                all_counts += Counter(actrep["overall_risk"]["counts"])

            total_all = sum(all_counts.values())
            score_sum_all = sum(EMOTION_SCORES.get(e, 0) * n for e, n in all_counts.items())
            risk_index_all = (score_sum_all / total_all) if total_all > 0 else 0.0
            if risk_index_all <= -0.4:
                overall_label_all = "🔴 Alto riesgo"
            elif risk_index_all < 0.2:
                overall_label_all = "🟡 Riesgo medio"
            else:
                overall_label_all = "🟢 Bajo riesgo"

            stu_entry["overall_risk"] = {
                "counts": dict(all_counts),
                "total": total_all,
                "risk_index": round(risk_index_all, 3),
                "risk_label": overall_label_all,
            }

            result["students"].append(stu_entry)

        return Response(result, status=200)