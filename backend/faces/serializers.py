from rest_framework import serializers
from .models import FaceRecord, CustomUser, Classroom, Activity, Enrollment, Option, Question, Quiz
from django.db import IntegrityError


# ____Examen___
class OptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionCreateSerializer(serializers.ModelSerializer):
    options = OptionCreateSerializer(many=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'options']


class QuizCreateSerializer(serializers.ModelSerializer):
    questions = QuestionCreateSerializer(many=True)

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'questions']

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        quiz = Quiz.objects.create(**validated_data)

        for idx, qd in enumerate(questions_data):
            options_data = qd.pop('options', [])
            # Saca 'order' de qd para no pasarlo dos veces
            order_val = qd.pop('order', idx)
            try:
                order_val = int(order_val)
            except (TypeError, ValueError):
                order_val = idx

            question = Question.objects.create(quiz=quiz, order=order_val, **qd)

            for od in options_data:
                # Por si 'is_correct' llega como string:
                is_correct = bool(od.get('is_correct'))
                Option.objects.create(
                    question=question,
                    text=od.get('text', ''),
                    is_correct=is_correct
                )

        return quiz


# Públicos para alumno (sin is_correct)
class OptionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text']


class QuestionPublicSerializer(serializers.ModelSerializer):
    options = OptionPublicSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'options']


class QuizPublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'questions']

# -------- FaceRecord --------
class FaceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaceRecord
        fields = ['id', 'name', 'emotion', 'timestamp', 'user', 'activity', 'phase']
        read_only_fields = ['timestamp']



# -------- Users --------
class UserPublicSerializer(serializers.ModelSerializer):
    """Para respuestas: NO expone password."""
    image = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'codigo', 'cedula', 'image']

    def get_image(self, obj):
        # Devuelve URL absoluta si hay request en context; si no, la relativa.
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class UserCreateSerializer(serializers.ModelSerializer):
    """Para registro/creación de usuario."""
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password', 'role', 'codigo', 'cedula', 'image']

    def create(self, validated_data):
        password = validated_data.pop('password')
        try:
            user = CustomUser(**validated_data)
            user.set_password(password)
            user.save()
            return user
        except IntegrityError:
            raise serializers.ValidationError({"cedula": "Este número de cédula ya está registrado."})


# -------- Classrooms & Activities --------
class ClassroomMiniSerializer(serializers.ModelSerializer):
    """Versión corta para anidar en otras respuestas (Enrollment, Activity, etc.)."""
    class Meta:
        model = Classroom
        fields = ['id', 'name', 'description']

#_______Actividades______
# faces/serializers.py
class ActivitySerializer(serializers.ModelSerializer):
    classroom = ClassroomMiniSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(
        source='classroom',
        queryset=Classroom.objects.all(),
        write_only=True,
        required=False
    )
    has_quiz = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            'id', 'classroom', 'classroom_id',
            'title', 'description', 'due_date',
            'type', 'video_url', 'has_quiz'
        ]
        read_only_fields = ['classroom', 'has_quiz']

    def get_has_quiz(self, obj):
        return hasattr(obj, 'quiz')



class ClassroomSerializer(serializers.ModelSerializer):
    teacher = UserPublicSerializer(read_only=True)
    # Evitamos asignar actividades vía PKs. Damos conteo o lista de solo lectura mínima.
    activities_count = serializers.IntegerField(source='activities.count', read_only=True)

    class Meta:
        model = Classroom
        fields = ['id', 'name', 'description', 'teacher', 'activities_count', 'code']
        read_only_fields = ['teacher', 'activities_count', 'code']



# -------- Enrollments --------
class EnrollmentSerializer(serializers.ModelSerializer):
    student = UserPublicSerializer(read_only=True)
    classroom = ClassroomMiniSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'classroom', 'date_enrolled']
