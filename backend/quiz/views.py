import json

from google import genai

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

MODEL_GEMINI = 'gemini-3.5-flash'

def _extrair_json(texto):
    """Remove cercas de code block (```json ... ```) e faz parse do JSON."""
    texto = texto.strip()
    if texto.startswith('```'):
        texto = texto.strip('`')
        if texto.lower().startswith('json'):
            texto = texto[4:].strip()
    return json.loads(texto)


def _sem_api_key():
    return Response(
        {'error': 'GEMINI_API_KEY não configurada. Verifique o arquivo .env.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class GenerateQuizView(APIView):
    """
    Gera 5 perguntas bíblicas via Gemini com base na dificuldade informada.
    Aceita POST com o parâmetro 'dificuldade': facil, medio ou dificil.
    """
    def post(self, request):
        dificuldade = request.data.get('dificuldade')
        quantidade = int(request.data.get('quantidade', 5))
        tema = request.data.get('tema', '') # NOVO: Captura o tema

        if dificuldade not in self.DIFFICULTIES:
            return Response({'error': 'Dificuldade inválida.'}, status=status.HTTP_400_BAD_REQUEST)
# ... (resto continua igual)

    DIFFICULTIES = ['facil', 'medio', 'dificil', 'extremo']

    def post(self, request):
        dificuldade = request.data.get('dificuldade')
        # Pega a quantidade do frontend, se não vier, usa 5 como padrão
        quantidade = int(request.data.get('quantidade', 5)) 
        tema = request.data.get('tema', '')  # NOVO: Captura o tema do frontend
        
        if dificuldade not in self.DIFFICULTIES:
            return Response({'error': 'Dificuldade inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if quantidade not in [3, 5, 7, 10]:
            return Response({'error': 'Quantidade inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Agora passamos a quantidade para a função do Gemini
            perguntas = self._gerar_perguntas(dificuldade, quantidade, tema)
            return Response(
                {'dificuldade': dificuldade, 'quantidade': quantidade, 'perguntas': perguntas},
                status=status.HTTP_200_OK
                
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        
    # Note que agora a função pede a variável "quantidade"
    # Adicione o parâmetro 'tema' aqui
    def _gerar_perguntas(self, dificuldade, quantidade, tema):
        
        # NOVO: Regra condicional para o prompt
        regra_tema = f'\nO TEMA EXCLUSIVO DAS PERGUNTAS DEVE SER: "{tema}".' if tema else ''
        
        prompt = f"""
Você é um especialista em quiz bíblico. Gere EXATAMENTE {quantidade} perguntas bíblicas
de nível de dificuldade "{dificuldade}".{regra_tema}

REGRAS OBRIGATÓRIAS:
1. Responda SOMENTE com JSON válido.
2. O JSON deve ser uma lista de {quantidade} objetos no seguinte formato:
[
  {{
    "id": 1, 
    "pergunta": "...", 
    "opcoes": ["A) ...", "B) ...", "C) ...", "D) ..."], 
    "resposta_correta": "texto EXATO da opção correta, incluindo a letra"
  }}
]
"""
        # ... (resto continua exatamente igual)
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=MODEL_GEMINI,
            contents=prompt,
        )
        
        texto_limpo = self._extrair_json(response.text)
        perguntas = json.loads(texto_limpo)

        # Valida se a IA realmente mandou a quantidade certa
        if not isinstance(perguntas, list) or len(perguntas) != quantidade:
            raise ValueError(f'O Gemini não retornou {quantidade} perguntas.')

        return perguntas
    def _extrair_json(self, texto):
        """Limpa a formatação markdown que o Gemini pode retornar."""
        texto = texto.strip()
        if texto.startswith("```json"):
            texto = texto[7:]
        elif texto.startswith("```"):
            texto = texto[3:]
        
        if texto.endswith("```"):
            texto = texto[:-3]
            
        return texto.strip()

class ValidateQuizView(APIView):
    """
    Valida as respostas do usuário via Gemini.
    Aceita POST com:
      - perguntas: lista das 5 perguntas originais
      - respostas_usuario: dict {id_da_pergunta: resposta_marcada}
    Retorna {'pontuacao': int, 'feedbacks': [...]}.
    """

    def post(self, request):
        perguntas = request.data.get('perguntas')
        respostas_usuario = request.data.get('respostas_usuario')

        if not isinstance(perguntas, list) or len(perguntas) not in [3, 5, 7, 10]:
            return Response(
                {'error': "'perguntas' deve ser uma lista com 3, 5, 7 ou 10 perguntas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(respostas_usuario, dict):
            return Response(
                {
                    'error': "'respostas_usuario' deve ser um dicionário "
                    "no formato {id_da_pergunta: resposta_marcada}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.GEMINI_API_KEY:
            return _sem_api_key()

        try:
            resultado = self._validar_respostas(perguntas, respostas_usuario)
        except Exception as exc:
            return Response(
                {'error': f'Erro ao consultar o Gemini: {str(exc)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(resultado, status=status.HTTP_200_OK)

    def _validar_respostas(self, perguntas, respostas_usuario):
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        dados = {
            'perguntas': perguntas,
            'respostas_usuario': respostas_usuario,
        }

        prompt = f"""
Você é um avaliador de quiz bíblico. Compare as perguntas originais com as
respostas marcadas pelo usuário e avalie cada uma.

DADOS (JSON):
{json.dumps(dados, ensure_ascii=False, indent=2)}

REGRAS OBRIGATÓRIAS:
1. Responda SOMENTE com JSON válido, sem texto, sem formatação, sem markdown.
2. O JSON deve ter EXATAMENTE este formato:
{{
  "pontuacao": 3,
  "feedbacks": [
    {{
      "pergunta": "texto da pergunta",
      "acertou": true,
      "resposta_correta": "alternativa correta",
      "explicacao": "breve explicação bíblica de por que está certo ou errado"
    }}
  ]
}}
3. "feedbacks" deve conter UM objeto para cada pergunta (5 no total), na mesma ordem.
4. "acertou" deve ser true/false conforme a resposta marcada confira com a correta.
5. "pontuacao" deve ser a quantidade de acertos (0 a 5).
6. Use a pergunta original no campo "pergunta", não a resposta do usuário.
"""

        response = client.models.generate_content(
            model=MODEL_GEMINI,
            contents=prompt,
        )

        resultado = _extrair_json(response.text)

        if not isinstance(resultado, dict):
            raise ValueError('O Gemini não retornou um objeto JSON válido.')

        if 'pontuacao' not in resultado or not isinstance(resultado.get('feedbacks'), list):
            raise ValueError('O Gemini não retornou os campos "pontuacao" e "feedbacks".')

        quantidade_esperada = len(perguntas)
        if len(resultado['feedbacks']) != quantidade_esperada:
            raise ValueError(f'O Gemini não retornou feedbacks para as {quantidade_esperada} perguntas.')

        return resultado
    