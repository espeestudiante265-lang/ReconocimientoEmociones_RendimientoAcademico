from django.db import models
from django.contrib.auth.models import AbstractUser
import string, random
from django.conf import settings

def generate_class_code(n=6):
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choice(chars) for _ in range(n))

class FaceRecord(models.Model):
    name = models.CharField(max_length=100)
    emotion = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)

    # 👇 referencias robustas
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # 'faces.CustomUser'
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='face_records'
    )
    activity = models.ForeignKey(
        'faces.Activity',          # 👈 usa app label explícito
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='face_records'
    )
    phase = models.CharField(
        max_length=16,
        choices=[('video', 'video'), ('quiz', 'quiz')],
        null=True, blank=True
    )

    def __str__(self):
        return f"{self.name} - {self.emotion}"

class CustomUser(AbstractUser):
    ROLE_CHOICES = [('estudiante', 'Estudiante'), ('docente', 'Docente')]
    cedula = models.CharField(max_length=10, unique=True)          # pon unique=True si aplica
    codigo = models.CharField(max_length=10)          # NO unique si varios usan el mismo código de registro
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    image = models.ImageField(upload_to='profile_images/', null=True, blank=True)
    def __str__(self):
        return f"{self.username} ({self.role})"

class Classroom(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    teacher = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="classrooms")
    code = models.CharField(max_length=8, unique=True, db_index=True, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Autogenerar código si no existe
        if not self.code:
            for _ in range(10):
                candidate = generate_class_code(6).upper()
                if not Classroom.objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Enrollment(models.Model):
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="enrollments")
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="enrollments")
    date_enrolled = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "classroom"], name="unique_enrollment")
        ]

    def __str__(self):
        return f"{self.student.username} enrolled in {self.classroom.name}"
    
#  ---Videos---
class Activity(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="activities")
    title = models.CharField(max_length=255)
    description = models.TextField()
    due_date = models.DateTimeField()

    TYPE_CHOICES = (('TASK', 'Tarea'), ('VIDEO_QUIZ', 'Video+Quiz'))
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='TASK')
    video_url = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return self.title


class Quiz(models.Model):
    activity = models.OneToOneField(Activity, on_delete=models.CASCADE, related_name='quiz')
    title = models.CharField(max_length=255, default="Evaluación")


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.PositiveIntegerField(default=0)


class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)


class ActivityProgress(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='progress')
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='activity_progress')
    video_watched = models.BooleanField(default=False)
    unlocked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('activity', 'student')


class QuizSubmission(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='quiz_submissions')
    score = models.FloatField()
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('quiz', 'student')


class SubmissionAnswer(models.Model):
    submission = models.ForeignKey(QuizSubmission, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    option = models.ForeignKey(Option, on_delete=models.CASCADE)
    is_correct = models.BooleanField()

