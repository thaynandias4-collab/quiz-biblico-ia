import { useState } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';


const DIFFICULTIES = [
  { value: 'facil', label: 'Fácil', color: 'bg-green-600 hover:bg-green-700' },
  { value: 'medio', label: 'Médio', color: 'bg-yellow-600 hover:bg-yellow-700' },
  { value: 'dificil', label: 'Difícil', color: 'bg-red-600 hover:bg-red-700' },
  { value: 'extremo', label: 'Extremo', color: 'bg-purple-600 hover:bg-purple-700' },
];

const LETTERS = ['A', 'B', 'C', 'D'];

export default function App() {
  const [dificuldade, setDificuldade] = useState('');
  const [tema, setTema] = useState('');
  const [screen, setScreen] = useState('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);

const iniciarQuiz = async (dificuldadeEscolhida, quantidadeEscolhida) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/generate-quiz/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Agora mandamos as duas informações pro Django:
        body: JSON.stringify({ 
          dificuldade: dificuldadeEscolhida, 
          quantidade: quantidadeEscolhida,
          tema: tema
        }), 
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar perguntas');
      }

      setPerguntas(data.perguntas);
      setScreen('quiz');
    } catch (err) {
      setError(err.message);
      setScreen('home'); // Se der erro, volta pra tela inicial
    } finally {
      setLoading(false);
    }
  };

  const marcarResposta = (perguntaId, resposta) => {
    setRespostas((prev) => ({ ...prev, [perguntaId]: resposta }));
  };

  const todasRespondidas = perguntas.every((p) => respostas[p.id]);

const finalizarQuiz = () => {
    // Muda a tela imediatamente para o resultado sem carregar nada
    setScreen('result');
    
    let nota = 0;
    const feedbacksGerados = [];

    // Limpa espaços ou letrinhas para garantir que o acerto seja calculado com perfeição
    const limparTexto = (texto) => {
      if (!texto) return '';
      return texto.replace(/^[A-D]\)\s*/i, '').trim().toLowerCase();
    };

    perguntas.forEach((p) => {
      const respostaOriginal = p.resposta_correta;
      const respostaMarcada = respostas[p.id] || "";

      // Compara a resposta marcada com o gabarito
      const isCorrect = limparTexto(respostaMarcada) === limparTexto(respostaOriginal);

      if (isCorrect) {
        nota += 1;
      }

      // Monta o objeto de feedback no formato exato que a sua tela espera
      feedbacksGerados.push({
        pergunta: p.pergunta,
        acertou: isCorrect,
        resposta_correta: respostaOriginal.replace(/^[A-D]\)\s*/i, ''),
        explicacao: "" // Mantemos vazio para não poluir o visual
      });
    });

    setResultado({
      pontuacao: nota,
      feedbacks: feedbacksGerados
    });
  };
  
  const reiniciar = () => {
    setPerguntas([]);
    setRespostas({});
    setResultado(null);
    setError('');
    setScreen('theme'); // Volta para a tela de escolha de tema
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-12">
        <h1 
          onClick={() => {
            setScreen('intro');
            setLoading(false);
          }} 
          className="mb-2 text-center text-4xl font-bold tracking-tight cursor-pointer transition-colors hover:text-indigo-400"
        >
          Quiz Bíblico
        </h1>

        {error && (
          <div className="mb-6 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {screen === 'intro' && (
          <section className="flex flex-col items-center gap-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-8 text-center shadow-xl">
              <h2 className="mb-4 text-2xl font-bold text-indigo-400">Sobre o Projeto</h2>
              <p className="mb-6 max-w-md leading-relaxed text-slate-300">
                Bem-vindo ao Quiz Bíblico! Este projeto foi desenvolvido por <strong>Thaynan Dias, estagiário FullStack da T4E</strong>. 
                Ele utiliza React no Frontend e uma API construída em Django conectada à Inteligência Artificial do Claude para gerar perguntas dinâmicas e corrigir as respostas em tempo real. Seja bem-vindo e divirta-se testando seus conhecimentos bíblicos!
              </p>
              <button
               onClick={() => setScreen('theme')}
                className="w-full rounded-xl bg-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 hover:bg-indigo-700"
              >
                Jogar Agora!
              </button>
            </div>
          </section>
        )}

        {/* NOVA TELA DE ESCOLHER TEMA */}
        {screen === 'theme' && (
          <section className="flex flex-col items-center gap-6">
            <h2 className="text-center text-xl font-semibold text-slate-300">
              Escolha um Tema:
            </h2>
            
            <div className="grid grid-cols-1 gap-4 w-full max-w-sm mt-4">
              {[
                "Personagens Bíblicos", 
                "Conhecimento técnico e curiosidades", 
                "Quem disse isso?", 
                "Os 12 apóstolos", 
                "Êxodo", 
                "Apocalipse"
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTema(t);          // Salva o tema escolhido
                    setScreen('home');   // Vai para a tela de dificuldade
                  }}
                  className="rounded-xl bg-sky-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 hover:bg-sky-700"
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => setScreen('intro')}
              className="mt-6 text-sm font-medium text-slate-400 underline transition-colors hover:text-white"
            >
              Voltar para a Apresentação
            </button>
          </section>
        )}

        {screen === 'home' && (
          <section className="flex flex-col items-center gap-4">
            <h2 className="text-center text-lg font-semibold text-slate-300">
              Escolha a dificuldade:
            </h2>
            <div className="flex w-full flex-col gap-4 items-center">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => {
                  setDificuldade(d.value);
                  setScreen('quantity');
                  }}
                  disabled={loading}
                  className={`w-64 rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${d.color}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {/* NOVA TELA: ESCOLHA DE QUANTIDADE */}
        {screen === 'quantity' && (
          <section className="flex flex-col items-center gap-6">
            <h2 className="text-center text-xl font-semibold text-slate-300">
              Quantas perguntas você quer?
            </h2>
            
            {/* Os 4 botões de opções */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
              <button onClick={() => iniciarQuiz(dificuldade, 3)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">3</button>
              <button onClick={() => iniciarQuiz(dificuldade, 5)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">5</button>
              <button onClick={() => iniciarQuiz(dificuldade, 7)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">7</button>
              <button onClick={() => iniciarQuiz(dificuldade, 10)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">10</button>
            </div>

            {/* Botão de voltar */}
            <button
              onClick={() => setScreen('home')}
              className="mt-6 text-sm font-medium text-slate-400 underline transition-colors hover:text-white"
            >
              Voltar para Dificuldade
            </button>
          </section>
        )}

            {/* NOVO BOTÃO DE VOLTAR AQUI */}
            <button
              onClick={() => setScreen('intro')}
              className="mt-6 text-sm font-medium text-slate-400 underline transition-colors hover:text-white"
            >
              Voltar para a Apresentação
            </button>
          </section>
        )}
      {/* --- COLE O BLOCO NOVO EXATAMENTE AQUI --- */}
        {screen === 'quantity' && (
          <section className="flex flex-col items-center gap-6">
            <h2 className="text-center text-xl font-semibold text-slate-300">
              Quantas perguntas você quer?
            </h2>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mt-4">
              <button onClick={() => iniciarQuiz(dificuldade, 3)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">3</button>
              <button onClick={() => iniciarQuiz(dificuldade, 5)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">5</button>
              <button onClick={() => iniciarQuiz(dificuldade, 7)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">7</button>
              <button onClick={() => iniciarQuiz(dificuldade, 10)} className="rounded-xl bg-indigo-600 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-indigo-700">10</button>
            </div>

            <button
              onClick={() => setScreen('home')}
              className="mt-6 text-sm font-medium text-slate-400 underline transition-colors hover:text-white"
            >
              Voltar para Dificuldade
            </button>
          </section>
        )}
        {/* ----------------------------------------- */}

        {loading && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
            <p className="text-lg text-slate-300">Loading...</p>
          </div>
        )}

        {!loading && screen === 'quiz' && (
          <section className="w-full">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setScreen('home')}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Voltar
              </button>
              <span className="text-sm text-slate-400">
                {Object.keys(respostas).length}/{perguntas.length} respondidas
              </span>
            </div>

            <div className="space-y-8">
              {perguntas.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 shadow-lg"
                >
                  <h3 className="mb-4 text-lg font-semibold">
                    {p.id}. {p.pergunta}
                  </h3>
                  <div className="space-y-2">
                    {p.opcoes.map((opcao, idx) => {
                      const marcada = respostas[p.id] === opcao;
                      return (
                        <label
                          key={idx}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                            marcada
                              ? 'border-indigo-500 bg-indigo-500/20'
                              : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`pergunta-${p.id}`}
                            value={opcao}
                            checked={marcada}
                            onChange={() => marcarResposta(p.id, opcao)}
                            className="h-4 w-4 accent-indigo-500"
                          />
                          <span className="mr-1 text-sm font-bold text-slate-400">
                            {LETTERS[idx]})
                          </span>
                          {/* Limpeza aplicada aqui: */}
                          <span>{opcao.replace(/^[A-D]\)\s*/i, '')}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <button
              onClick={finalizarQuiz}
              disabled={!todasRespondidas}
              className="mt-8 w-full rounded-xl bg-indigo-600 px-6 py-4 text-lg font-semibold shadow-lg transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              Finalizar Quiz
            </button>

            {!todasRespondidas && (
              <p className="mt-3 text-center text-sm text-slate-500">
                Responda todas as perguntas para finalizar.
              </p>
            )}
          </section>
        )}

        {!loading && screen === 'result' && resultado && (
          <section className="w-full">
            
            {/* --- NOVO CARD DE PONTUAÇÃO DUOLINGO --- */}
            <div className="mb-8 rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center shadow-xl">
              <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
                Sua pontuação
              </p>
              
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold">{resultado.pontuacao}</span>
                {/* Aqui está dinâmico agora: puxa o total de perguntas que o usuário escolheu */}
                <span className="text-3xl text-slate-500"> / {perguntas.length}</span>
              </div>

              {/* Barra de Progresso */}
              <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-slate-700">
                <div 
                  className="h-4 rounded-full bg-green-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${(resultado.pontuacao / perguntas.length) * 100}%` }}
                ></div>
              </div>
              
              {/* Mensagens Dinâmicas baseadas na Porcentagem */}
              <div className="mt-4 text-lg font-bold">
                {(() => {
                  const porcentagem = (resultado.pontuacao / perguntas.length) * 100;
                  
                  if (porcentagem === 100) {
                    return <p className="text-yellow-400">Perfeito! Você é um mestre! 🏆</p>;
                  } else if (porcentagem >= 75) {
                    return <p className="text-green-400">Excelente trabalho! 👏</p>;
                  } else if (porcentagem >= 50) {
                    return <p className="text-blue-400">Muito bom! Quase lá! 👍</p>;
                  } else {
                    return <p className="text-orange-400">Continue praticando, não desista! 💪</p>;
                  }
                })()}
              </div>
            </div>
            {/* --- FIM DO CARD --- */}

            <div className="space-y-6">
              {resultado.feedbacks.map((fb, idx) => {
                const acertou = fb.acertou === true;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-6 shadow-lg ${
                      acertou
                        ? 'border-green-700 bg-green-900/30'
                        : 'border-red-700 bg-red-900/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold">{fb.pergunta}</h3>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          acertou
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {acertou ? 'Acertou' : 'Errou'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">
                      <span className="font-semibold text-slate-200">
                        Resposta correta:
                      </span>{' '}
                      {fb.resposta_correta}
                    </p>
                    
                  </div>
                );
              })}
            </div>

            <button
              onClick={reiniciar}
              className="mt-10 w-full rounded-xl bg-indigo-600 px-6 py-4 text-lg font-semibold shadow-lg transition-all hover:bg-indigo-700"
            >
              Jogar novamente
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
