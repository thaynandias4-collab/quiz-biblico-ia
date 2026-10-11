import json
import logging

from groq import BadRequestError, Groq, RateLimitError

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


MODEL_GROQ = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')
logger = logging.getLogger(__name__)
QUESTION_SCHEMA = {
    'type': 'object',
    'properties': {
        'perguntas': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'id': {'type': 'integer'},
                    'pergunta': {'type': 'string'},
                    'opcoes': {'type': 'array', 'items': {'type': 'string'}},
                    'resposta_correta': {'type': 'string'},
                },
                'required': ['id', 'pergunta', 'opcoes', 'resposta_correta'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['perguntas'],
    'additionalProperties': False,
}
VALIDATION_SCHEMA = {
    'type': 'object',
    'properties': {
        'pontuacao': {'type': 'integer'},
        'feedbacks': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'pergunta': {'type': 'string'},
                    'acertou': {'type': 'boolean'},
                    'resposta_correta': {'type': 'string'},
                    'explicacao': {'type': 'string'},
                },
                'required': ['pergunta', 'acertou', 'resposta_correta', 'explicacao'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['pontuacao', 'feedbacks'],
    'additionalProperties': False,
}


def _sem_api_key():
    return Response(
        {'error': 'A chave da Groq não está configurada. Defina GROQ_API_KEY em backend/.env e reinicie o backend.'},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _erro_de_validacao_json(exc):
    body = exc.body if isinstance(exc.body, dict) else {}
    erro = body.get('error', body)
    return isinstance(erro, dict) and erro.get('code') == 'json_validate_failed'


def _gerar_json_groq(prompt, schema_name, schema, validar):
    client = Groq(api_key=settings.GROQ_API_KEY)
    for modo in ('json_schema', 'json_object'):
        formato = (
            {
                'type': 'json_schema',
                'json_schema': {'name': schema_name, 'strict': True, 'schema': schema},
            }
            if modo == 'json_schema'
            else {'type': 'json_object'}
        )
        instrucoes = prompt
        if modo == 'json_object':
            instrucoes += '\nSiga esta estrutura JSON, usando exatamente os nomes e tipos dos campos:\n'
            instrucoes += json.dumps(schema, ensure_ascii=False)

        try:
            response = client.chat.completions.create(
                model=MODEL_GROQ,
                messages=[
                    {
                        'role': 'system',
                        'content': 'Responda em português somente com um objeto JSON válido, sem Markdown ou comentários.',
                    },
                    {'role': 'user', 'content': instrucoes},
                ],
                response_format=formato,
                temperature=0.2,
            )
        except BadRequestError as exc:
            if modo == 'json_schema' and _erro_de_validacao_json(exc):
                logger.warning('A Groq não validou o JSON estruturado; tentando modo JSON.')
                continue
            raise

        try:
            conteudo = response.choices[0].message.content
            if not conteudo:
                raise ValueError('A Groq retornou uma resposta vazia.')
            return validar(json.loads(conteudo))
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            if modo == 'json_schema':
                logger.warning('A primeira resposta da Groq veio fora do formato; tentando modo JSON.')
                continue
            raise ValueError('A Groq não conseguiu gerar os dados no formato esperado. Tente novamente.') from exc

    raise ValueError('A Groq não conseguiu gerar os dados no formato esperado. Tente novamente.')


class GenerateQuizView(APIView):
    """Gera perguntas bíblicas com a Groq."""

    DIFFICULTIES = ['facil', 'medio', 'dificil', 'extremo']
    QUANTITIES = [3, 5, 7, 10]

    def post(self, request):
        dificuldade = request.data.get('dificuldade')
        tema = request.data.get('tema', '')

        try:
            quantidade = int(request.data.get('quantidade', 5))
        except (TypeError, ValueError):
            return Response({'error': 'Quantidade inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        if dificuldade not in self.DIFFICULTIES:
            return Response({'error': 'Dificuldade inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantidade not in self.QUANTITIES:
            return Response({'error': 'Quantidade inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(tema, str):
            return Response({'error': 'Tema inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        if not settings.GROQ_API_KEY:
            return _sem_api_key()

        try:
            perguntas = self._gerar_perguntas(dificuldade, quantidade, tema.strip())
        except RateLimitError:
            return Response(
                {'error': 'A Groq atingiu um limite temporário. Aguarde um pouco e tente novamente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            logger.exception('Falha ao gerar perguntas na Groq')
            return Response(
                {'error': 'Não foi possível gerar o quiz agora. Tente novamente em alguns instantes.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                'dificuldade': dificuldade,
                'quantidade': quantidade,
                'perguntas': perguntas,
            },
            status=status.HTTP_200_OK,
        )

    def _gerar_perguntas(self, dificuldade, quantidade, tema):
        perguntas = []
        for inicio in range(0, quantidade, 3):
            tamanho_lote = min(3, quantidade - inicio)
            novas = self._gerar_lote(dificuldade, tamanho_lote, tema, perguntas)
            for pergunta in novas:
                pergunta['id'] += inicio
                perguntas.append(pergunta)
        return perguntas

    def _gerar_lote(self, dificuldade, quantidade, tema, anteriores):
        regra_tema = f'O tema exclusivo deve ser "{tema}".' if tema else ''
        evitar = (
            'Não repita estas perguntas já usadas: '
            + json.dumps([pergunta['pergunta'] for pergunta in anteriores], ensure_ascii=False)
            if anteriores else ''
        )
        prompt = f"""
Crie exatamente {quantidade} perguntas bíblicas em português, no nível "{dificuldade}".
{regra_tema}
{evitar}

Regras:
- Use fatos bíblicos verificáveis e perguntas claras, sem ambiguidade.
- Cada pergunta deve ter exatamente quatro alternativas, identificadas por A), B), C) e D).
- Inclua uma única resposta correta e copie seu texto exatamente em "resposta_correta", incluindo a letra.
- Numere os IDs de 1 até {quantidade}.
- Distribua as letras corretas entre as alternativas.
- Retorne um objeto JSON com a chave "perguntas" e os campos "id", "pergunta", "opcoes" e "resposta_correta" em cada item.
"""
        usadas = {pergunta['pergunta'].strip().casefold() for pergunta in anteriores}
        for tentativa in range(2):
            try:
                instrucao = prompt
                if tentativa:
                    instrucao += '\nEscreva perguntas e alternativas curtas para manter o JSON conciso.'
                novas = _gerar_json_groq(
                    instrucao,
                    'perguntas_do_quiz',
                    QUESTION_SCHEMA,
                    lambda resultado: self._validar_perguntas(resultado, quantidade),
                )
                textos = [pergunta['pergunta'].strip().casefold() for pergunta in novas]
                if len(set(textos)) != len(textos) or any(texto in usadas for texto in textos):
                    raise ValueError('A Groq repetiu uma pergunta já usada.')
                return novas
            except BadRequestError as exc:
                if not _erro_de_validacao_json(exc) or tentativa:
                    raise
                logger.warning('A Groq não validou o lote de perguntas; tentando novamente.')
            except ValueError:
                if tentativa:
                    raise
                logger.warning('O lote de perguntas veio fora do formato; tentando novamente.')

    @staticmethod
    def _validar_perguntas(resultado, quantidade):
        if not isinstance(resultado, dict):
            raise ValueError('A resposta não é um objeto JSON.')
        perguntas = resultado.get('perguntas')

        if not isinstance(perguntas, list) or len(perguntas) != quantidade:
            raise ValueError(f'A Groq não retornou exatamente {quantidade} perguntas.')

        for indice, pergunta in enumerate(perguntas, start=1):
            if not isinstance(pergunta, dict):
                raise ValueError(f'A pergunta {indice} veio fora do formato esperado.')
            opcoes = pergunta.get('opcoes', [])
            if (
                pergunta.get('id') != indice
                or not isinstance(pergunta.get('pergunta'), str)
                or not pergunta['pergunta'].strip()
                or not isinstance(opcoes, list)
                or len(opcoes) != 4
                or any(not isinstance(opcao, str) or not opcao.strip() for opcao in opcoes)
                or len(set(opcoes)) != 4
                or pergunta.get('resposta_correta') not in opcoes
            ):
                raise ValueError(f'A pergunta {indice} veio fora do formato esperado.')

        return perguntas


class ValidateQuizView(APIView):
    """Compara as respostas do usuário com o gabarito usando a Groq."""

    QUANTITIES = [3, 5, 7, 10]

    def post(self, request):
        perguntas = request.data.get('perguntas')
        respostas_usuario = request.data.get('respostas_usuario')

        if not isinstance(perguntas, list) or len(perguntas) not in self.QUANTITIES:
            return Response(
                {'error': "'perguntas' deve conter 3, 5, 7 ou 10 itens."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(respostas_usuario, dict):
            return Response(
                {'error': "'respostas_usuario' deve ser um objeto com as respostas marcadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not settings.GROQ_API_KEY:
            return _sem_api_key()

        try:
            resultado = self._validar_respostas(perguntas, respostas_usuario)
        except RateLimitError:
            return Response(
                {'error': 'A Groq atingiu um limite temporário. Aguarde um pouco e tente novamente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            logger.exception('Falha ao validar respostas na Groq')
            return Response(
                {'error': 'Não foi possível validar as respostas agora. Tente novamente em alguns instantes.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(resultado, status=status.HTTP_200_OK)

    def _validar_respostas(self, perguntas, respostas_usuario):
        dados = {'perguntas': perguntas, 'respostas_usuario': respostas_usuario}
        prompt = f"""
Avalie as respostas marcadas comparando-as com o campo "resposta_correta" de cada pergunta.
Use a pergunta original, mantenha a mesma ordem e escreva uma explicação curta em português.
Calcule a pontuação como o número de respostas corretas.

Dados:
{json.dumps(dados, ensure_ascii=False)}
"""
        return _gerar_json_groq(
            prompt,
            'resultado_do_quiz',
            VALIDATION_SCHEMA,
            lambda resultado: self._validar_feedback(resultado, len(perguntas)),
        )

    @staticmethod
    def _validar_feedback(resultado, quantidade):
        if not isinstance(resultado, dict):
            raise ValueError('A resposta não é um objeto JSON.')
        feedbacks = resultado.get('feedbacks')

        if not isinstance(feedbacks, list) or len(feedbacks) != quantidade:
            raise ValueError('A Groq não retornou feedback para todas as perguntas.')
        if not isinstance(resultado.get('pontuacao'), int) or not 0 <= resultado['pontuacao'] <= quantidade:
            raise ValueError('A Groq retornou uma pontuação inválida.')
        for feedback in feedbacks:
            if not isinstance(feedback, dict) or not all(
                isinstance(feedback.get(campo), tipo)
                for campo, tipo in (
                    ('pergunta', str), ('acertou', bool),
                    ('resposta_correta', str), ('explicacao', str),
                )
            ):
                raise ValueError('A Groq retornou feedback fora do formato esperado.')
        return resultado
