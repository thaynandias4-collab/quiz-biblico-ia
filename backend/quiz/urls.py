from django.urls import path

from .views import GenerateQuizView, ValidateQuizView

urlpatterns = [
    path('generate-quiz/', GenerateQuizView.as_view(), name='generate-quiz'),
    path('validate-quiz/', ValidateQuizView.as_view(), name='validate-quiz'),
]
