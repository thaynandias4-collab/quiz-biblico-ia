import json
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase, override_settings
from groq import BadRequestError

from quiz.views import GenerateQuizView, QUESTION_SCHEMA, _gerar_json_groq


def _resposta(conteudo):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(conteudo)))])


def _perguntas_validas():
    return {
        'perguntas': [
            {
                'id': indice,
                'pergunta': f'Pergunta {indice}?',
                'opcoes': ['A) Um', 'B) Dois', 'C) Três', 'D) Quatro'],
                'resposta_correta': 'A) Um',
            }
            for indice in range(1, 4)
        ],
    }


def _erro_groq(codigo):
    request = httpx.Request('POST', 'https://api.groq.com/openai/v1/chat/completions')
    response = httpx.Response(400, request=request)
    return BadRequestError('Groq recusou a resposta.', response=response, body={'error': {'code': codigo}})


@override_settings(GROQ_API_KEY='chave-ficticia')
class GeracaoJsonTests(SimpleTestCase):
    @patch('quiz.views.Groq')
    def test_faz_fallback_quando_groq_nao_valida_json(self, groq):
        criar = groq.return_value.chat.completions.create
        criar.side_effect = [_erro_groq('json_validate_failed'), _resposta(_perguntas_validas())]

        perguntas = _gerar_json_groq(
            'Crie três perguntas.', 'perguntas_do_quiz', QUESTION_SCHEMA,
            lambda dados: GenerateQuizView._validar_perguntas(dados, 3),
        )

        self.assertEqual(len(perguntas), 3)
        self.assertEqual(criar.call_count, 2)
        self.assertEqual(criar.call_args_list[0].kwargs['response_format']['type'], 'json_schema')
        self.assertEqual(criar.call_args_list[1].kwargs['response_format']['type'], 'json_object')

    @patch('quiz.views.Groq')
    def test_faz_fallback_quando_resposta_nao_tem_todas_as_perguntas(self, groq):
        criar = groq.return_value.chat.completions.create
        criar.side_effect = [_resposta({'perguntas': []}), _resposta(_perguntas_validas())]

        perguntas = _gerar_json_groq(
            'Crie três perguntas.', 'perguntas_do_quiz', QUESTION_SCHEMA,
            lambda dados: GenerateQuizView._validar_perguntas(dados, 3),
        )

        self.assertEqual(len(perguntas), 3)
        self.assertEqual(criar.call_count, 2)

    @patch('quiz.views.Groq')
    def test_nao_repete_erros_400_que_nao_sao_de_json(self, groq):
        criar = groq.return_value.chat.completions.create
        criar.side_effect = _erro_groq('invalid_api_key')

        with self.assertRaises(BadRequestError):
            _gerar_json_groq(
                'Crie três perguntas.', 'perguntas_do_quiz', QUESTION_SCHEMA,
                lambda dados: GenerateQuizView._validar_perguntas(dados, 3),
            )

        self.assertEqual(criar.call_count, 1)

    @patch.object(GenerateQuizView, '_gerar_lote')
    def test_gera_dez_perguntas_em_lotes_de_ate_tres(self, gerar_lote):
        gerar_lote.side_effect = [
            [{**pergunta, 'pergunta': f'Lote {lote}: {pergunta["pergunta"]}'}
             for pergunta in _perguntas_validas()['perguntas'][:tamanho]]
            for lote, tamanho in enumerate((3, 3, 3, 1), start=1)
        ]

        perguntas = GenerateQuizView()._gerar_perguntas('medio', 10, 'Quem disse isso?')

        self.assertEqual([pergunta['id'] for pergunta in perguntas], list(range(1, 11)))
        self.assertEqual([chamada.args[1] for chamada in gerar_lote.call_args_list], [3, 3, 3, 1])

    @patch('quiz.views._gerar_json_groq')
    def test_repete_lote_apos_erro_de_validacao_json(self, gerar_json):
        gerar_json.side_effect = [_erro_groq('json_validate_failed'), _perguntas_validas()['perguntas']]

        perguntas = GenerateQuizView()._gerar_lote('facil', 3, 'Quem disse isso?', [])

        self.assertEqual(len(perguntas), 3)
        self.assertEqual(gerar_json.call_count, 2)
