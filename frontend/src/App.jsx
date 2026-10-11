import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const XP_STORAGE_KEY = 'quiz-biblico-ia:total-xp:v1';
const DEMO_REWARD_STORAGE_KEY = 'quiz-biblico-ia:demo-reward:v1';
const XP_PER_CORRECT_ANSWER = 100;
const LETTERS = ['A', 'B', 'C', 'D'];

function LetterMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M12 14V7h24v7" fill="#FFF9E8" stroke="#392050" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="5" y="13" width="38" height="28" rx="3" fill="#FFF9E8" stroke="#392050" strokeWidth="2.5" />
      <path d="M6 16l18 14 18-14M6 38l13-12m23 12L29 26" stroke="#392050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="29" r="3.5" fill="#FFC64A" stroke="#392050" strokeWidth="1.5" />
    </svg>
  );
}

const THEMES = [
  { name: 'Aleatório', note: 'Assuntos diferentes em cada rodada', mark: '🎲', tone: 'random', featured: true },
  { name: 'Personagens bíblicos', note: 'Heróis, escolhas e reviravoltas', mark: '🧙', tone: 'lilac' },
  { name: 'Conhecimento e curiosidades', note: 'Detalhes que quase passam batido', mark: '🧠', tone: 'lemon' },
  { name: 'Quem disse isso?', note: 'Adivinhe quem mandou essa frase', mark: '💬', tone: 'pink' },
  { name: 'Os 12 apóstolos', note: 'O time que caminhou com Jesus', mark: '⛵', tone: 'sky' },
  { name: 'Êxodo', note: 'Uma aventura rumo à liberdade', mark: '🏜️', tone: 'orange' },
  { name: 'Apocalipse', note: 'Visões, mistérios e esperança', mark: '🌟', tone: 'lilac' },
  { name: 'Criação e Gênesis', note: 'O começo de todas as histórias', mark: '🌱', tone: 'mint' },
  { name: 'Mulheres da Bíblia', note: 'Coragem, fé e grandes escolhas', mark: '👑', tone: 'pink' },
  { name: 'Parábolas de Jesus', note: 'Histórias que fazem pensar', mark: '🪴', tone: 'mint' },
  { name: 'Milagres de Jesus', note: 'Encontros que mudaram vidas', mark: '✨', tone: 'sky' },
  { name: 'Salmos e Provérbios', note: 'Poesia e sabedoria pra vida', mark: '🎵', tone: 'lemon' },
  { name: 'Cartas do Novo Testamento', note: 'Conselhos para as primeiras comunidades', mark: <LetterMark />, tone: 'orange' },
];

const DIFFICULTIES = [
  { value: 'facil', label: 'Aquecimento', detail: 'Comece de boa', mark: '●', tone: 'mint', unlockXp: 0 },
  { value: 'medio', label: 'Explorador', detail: 'Na medida pra subir de nível', mark: '◆', tone: 'lemon', unlockXp: 300 },
  { value: 'dificil', label: 'Desafio', detail: 'Agora o jogo fica sério', mark: '▲', tone: 'pink', unlockXp: 900 },
  { value: 'extremo', label: 'Lenda', detail: 'Só os brabos chegam aqui', mark: '✦', tone: 'lilac', unlockXp: 1800 },
];

const QUANTITIES = [3, 5, 7, 10];
const STEP_NAMES = ['Tema', 'Nível', 'Tamanho', 'Partiu'];

function cleanOption(value = '') {
  return value.replace(/^[A-D]\)\s*/i, '').trim();
}

function isCorrectAnswer(question, selected) {
  return Boolean(selected) && cleanOption(selected).toLocaleLowerCase('pt-BR') === cleanOption(question.resposta_correta).toLocaleLowerCase('pt-BR');
}

function getAnswerStreak(questions, answers, index) {
  let streak = 0;
  for (let questionIndex = index; questionIndex >= 0; questionIndex -= 1) {
    const question = questions[questionIndex];
    if (!isCorrectAnswer(question, answers[question.id])) break;
    streak += 1;
  }
  return streak;
}

function readStoredXp() {
  try {
    const value = Number(window.localStorage.getItem(XP_STORAGE_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function readDemoRewardClaimed() {
  try {
    return window.localStorage.getItem(DEMO_REWARD_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function getCurrentLevel(totalXp) {
  for (let index = DIFFICULTIES.length - 1; index >= 0; index -= 1) {
    if (totalXp >= DIFFICULTIES[index].unlockXp) return DIFFICULTIES[index];
  }
  return DIFFICULTIES[0];
}

function XpCard({ totalXp, level, nextLevel }) {
  const remainingXp = nextLevel ? nextLevel.unlockXp - totalXp : 0;
  const progress = nextLevel
    ? Math.round(((totalXp - level.unlockXp) / (nextLevel.unlockXp - level.unlockXp)) * 100)
    : 100;

  return (
    <div className="xp-card" aria-label={`${totalXp} XP acumulados. Nível ${level.label}. ${nextLevel ? `Faltam ${remainingXp} XP para ${nextLevel.label}.` : 'Nível máximo alcançado.'}`}>
      <span className="xp-card-bolt" aria-hidden="true">⚡</span>
      <div className="xp-card-display">
        <div className="xp-card-top"><span>Seu XP</span><span>LV {String(DIFFICULTIES.indexOf(level) + 1).padStart(2, '0')}</span></div>
        <div className="xp-card-value"><strong>{totalXp.toLocaleString('pt-BR')}</strong><span>XP</span></div>
        <div className="xp-card-track" role="progressbar" aria-label={`Progresso para ${nextLevel?.label || 'o nível máximo'}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        <span className="xp-card-next">{nextLevel ? `${remainingXp} XP para ${nextLevel.label}` : 'Nível máximo alcançado'}</span>
      </div>
    </div>
  );
}

function BookMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 42 42" aria-hidden="true">
      <path d="M6.5 9.5c6.3-2.2 11.4-.8 14.5 2.4v23c-3.1-3.2-8.2-4.6-14.5-2.4z" />
      <path d="M35.5 9.5c-6.3-2.2-11.4-.8-14.5 2.4v23c3.1-3.2 8.2-4.6 14.5-2.4z" />
      <path d="M10 15c3.5-.8 6.5-.2 8.5 1.1M10 20c3.5-.8 6.5-.2 8.5 1.1M32 15c-3.5-.8-6.5-.2-8.5 1.1M32 20c-3.5-.8-6.5-.2-8.5 1.1" />
    </svg>
  );
}

function Trail({ active, onBack }) {
  return (
    <div className="trail-wrap">
      <div className="trail" aria-label={`Etapa ${active + 1} de ${STEP_NAMES.length}`}>
        {STEP_NAMES.map((step, index) => (
          <div className={`trail-step ${index < active ? 'is-done' : ''} ${index === active ? 'is-current' : ''}`} key={step}>
            <span className="trail-dot" aria-hidden="true">{index < active ? '✓' : ''}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      {onBack && <button className="text-button trail-back" onClick={onBack}>Voltar</button>}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('intro');
  const [tema, setTema] = useState('');
  const [dificuldade, setDificuldade] = useState('');
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoAnswer, setDemoAnswer] = useState('');
  const [demoFeedback, setDemoFeedback] = useState('Escolhe uma resposta pra testar');
  const [demoRewardClaimed, setDemoRewardClaimed] = useState(readDemoRewardClaimed);
  const [totalXp, setTotalXp] = useState(readStoredXp);
  const demoRewarded = useRef(demoRewardClaimed);
  const roundAwarded = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(XP_STORAGE_KEY, String(totalXp));
    } catch {
      // Keep the current session playable when browser storage is unavailable.
    }
  }, [totalXp]);

  useEffect(() => {
    if (!demoRewardClaimed) return;
    try {
      window.localStorage.setItem(DEMO_REWARD_STORAGE_KEY, '1');
    } catch {
      // The reward still counts for this session if storage is unavailable.
    }
  }, [demoRewardClaimed]);

  const currentQuestion = perguntas[currentIndex];
  const answeredCount = useMemo(() => perguntas.filter((question) => respostas[question.id]).length, [perguntas, respostas]);
  const roundCorrectCount = useMemo(() => perguntas.filter((question) => isCorrectAnswer(question, respostas[question.id])).length, [perguntas, respostas]);
  const currentAnswer = currentQuestion && respostas[currentQuestion.id];
  const currentAnswerIsCorrect = currentQuestion && isCorrectAnswer(currentQuestion, currentAnswer);
  const currentStreak = currentQuestion ? getAnswerStreak(perguntas, respostas, currentIndex) : 0;
  const activeStep = ({ theme: 0, difficulty: 1, quantity: 2, quiz: 3 })[screen] ?? 0;
  const currentLevel = getCurrentLevel(totalXp);
  const nextLevel = DIFFICULTIES[DIFFICULTIES.indexOf(currentLevel) + 1];

  const backFrom = () => {
    if (screen === 'difficulty') setScreen('theme');
    else if (screen === 'quantity') setScreen('difficulty');
    else if (screen === 'quiz') setScreen('quantity');
  };

  const responderDesafioInicial = (option) => {
    setDemoAnswer(option);
    if (option !== 'Noé') {
      setDemoFeedback('Quase! Foi Noé. Tenta outra!');
      return;
    }
    if (demoRewarded.current) {
      setDemoFeedback('Acertou! Você já recebeu os 100 XP deste desafio.');
      return;
    }

    demoRewarded.current = true;
    setDemoRewardClaimed(true);
    setTotalXp((previous) => previous + XP_PER_CORRECT_ANSWER);
    setDemoFeedback('Acertou! +100 XP no seu placar ✨');
  };

  const iniciarQuiz = async (quantidade) => {
    const selectedLevel = DIFFICULTIES.find((level) => level.value === dificuldade);
    if (!selectedLevel || totalXp < selectedLevel.unlockXp) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/generate-quiz/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dificuldade, quantidade, tema }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar as perguntas. Tente novamente.');
      if (!Array.isArray(data.perguntas) || data.perguntas.length === 0) throw new Error('A resposta veio sem perguntas. Tente gerar o quiz novamente.');
      setPerguntas(data.perguntas);
      setRespostas({});
      setResultado(null);
      setCurrentIndex(0);
      roundAwarded.current = false;
      setScreen('quiz');
    } catch (err) {
      setError(err.message || 'Não foi possível conectar ao quiz. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const marcarResposta = (perguntaId, resposta) => {
    setRespostas((previous) => previous[perguntaId] ? previous : { ...previous, [perguntaId]: resposta });
  };

  const finalizarQuiz = () => {
    if (roundAwarded.current || perguntas.length === 0 || perguntas.some((question) => !respostas[question.id])) return;
    roundAwarded.current = true;
    const feedbacks = perguntas.map((question) => {
      const selected = respostas[question.id] || '';
      const correct = isCorrectAnswer(question, selected);
      return {
        pergunta: question.pergunta,
        acertou: correct,
        resposta_marcada: cleanOption(selected),
        resposta_correta: cleanOption(question.resposta_correta),
        explicacao: question.explicacao || '',
      };
    });
    const pontuacao = feedbacks.filter((item) => item.acertou).length;
    const xpEarned = pontuacao * XP_PER_CORRECT_ANSWER;
    const newLevel = getCurrentLevel(totalXp + xpEarned);
    setResultado({
      pontuacao,
      feedbacks,
      xpEarned,
      levelUnlocked: newLevel.unlockXp > currentLevel.unlockXp ? newLevel.label : null,
    });
    setTotalXp((previous) => previous + xpEarned);
    setScreen('result');
  };

  const reiniciar = () => {
    setPerguntas([]);
    setRespostas({});
    setResultado(null);
    setError('');
    setScreen('theme');
  };

  const voltarInicio = () => {
    setError('');
    setScreen('intro');
  };

  const percent = resultado && perguntas.length ? Math.round((resultado.pontuacao / perguntas.length) * 100) : 0;
  const resultMessage = resultado?.levelUnlocked ? `Nova fase: ${resultado.levelUnlocked}!` : percent === 100 ? 'Rodada perfeita!' : percent >= 75 ? 'Mandou muito bem!' : percent >= 50 ? 'Boa! Você tá no caminho.' : 'Mais uma rodada e você sobe de nível!';

  return (
    <main className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={voltarInicio} aria-label="Quiz Bíblico, voltar ao início">
          <BookMark />
          <span>Quiz <b>Bíblico</b></span>
        </button>
        <nav className="header-actions" aria-label="Navegação principal">
          {screen === 'intro' && <a className="about-nav" href="#about">Sobre o criador</a>}
        </nav>
        <XpCard totalXp={totalXp} level={currentLevel} nextLevel={nextLevel} />
      </header>

      {error && <div className="alert" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}

      {screen === 'intro' && (
        <section className="home-screen page-width" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="kicker"><span className="kicker-line" /> Sua próxima missão começa aqui</p>
            <h1 id="home-title">Bora testar<br />o que você sabe?</h1>
            <p className="hero-description">Histórias, personagens e desafios bíblicos. Escolha uma missão, marque pontos e descubra seu nível.</p>
            <button className="primary-button hero-button" onClick={() => setScreen('theme')}>
              Jogar agora <span aria-hidden="true">✦</span>
            </button>
            <p className="hero-footnote"><span aria-hidden="true">⚡</span> Uma rodada rápida já vale XP.</p>
          </div>

          <div className="demo-scene" aria-label="Mapa ilustrado com pergunta demonstrativa interativa">
            <div className="map-label"><span>🧭</span> MAPA DAS HISTÓRIAS</div>
            <div className="map-island" aria-hidden="true">
              <svg className="map-path" viewBox="0 0 440 420" fill="none">
                <path d="M42 333C95 327 61 246 139 250C218 254 202 341 278 309C347 281 287 204 358 190C407 180 389 130 369 85" />
              </svg>
              <span className="map-stop stop-start">⚑</span><span className="map-stop stop-mid">✦</span><span className="map-stop stop-end">🏆</span>
              <span className="map-bush bush-one" /><span className="map-bush bush-two" /><span className="map-bush bush-three" />
              <span className="map-star star-one">✦</span><span className="map-star star-two">✧</span>
            </div>
            <div className="scene-caption"><span>FASE 01 · AQUECIMENTO</span><span className={`caption-mark ${demoRewardClaimed ? 'is-claimed' : ''}`}>{demoRewardClaimed ? 'XP RESGATADO' : '+100 XP'}</span></div>
            <article className="demo-card">
              <div className="demo-card-top"><span className="demo-chip">DESAFIO RELÂMPAGO</span><span className={`demo-points ${demoRewardClaimed ? 'is-claimed' : ''}`}>{demoRewardClaimed ? '✓ XP resgatado' : '⚡ 100 XP'}</span></div>
              <h2>Quem construiu uma arca para atravessar o dilúvio?</h2>
              <div className="demo-options">
                {['Moisés', 'Davi', 'Noé', 'Abraão'].map((option, index) => (
                  <button
                    className={`demo-option ${demoAnswer === option ? (option === 'Noé' ? 'demo-correct' : 'demo-wrong') : ''}`}
                    key={option}
                    onClick={() => responderDesafioInicial(option)}
                    aria-pressed={demoAnswer === option}
                  >
                    <span>{LETTERS[index]}</span>{option}{demoAnswer === option && <b aria-hidden="true">{option === 'Noé' ? '✓' : '×'}</b>}
                  </button>
                ))}
              </div>
              <p className={`demo-feedback ${demoAnswer ? 'is-visible' : ''}`} aria-live="polite">
                {demoFeedback}
              </p>
            </article>
            <div className="scene-verse"><span className="verse-star">✦</span><span>Seu conhecimento é o superpoder.</span></div>
          </div>
          <div className="home-signature"><span>Quiz Bíblico</span><span className="signature-rule" /><span>Desafie sua memória. Colecione XP.</span></div>
        </section>
      )}

      {screen === 'intro' && (
        <section className="about-section page-width" id="about" aria-labelledby="about-title">
          <div className="about-card">
            <div className="about-portrait-wrap">
              <div className="portrait-spark portrait-spark-one" aria-hidden="true">✦</div>
              <img
                className="about-portrait"
                src="/images/thaynan-profile.jpg"
                alt="Thaynan Dias, criador do Quiz Bíblico"
                loading="lazy"
                decoding="async"
              />
              <span className="portrait-caption">QUEM CRIOU ESSA MISSÃO?</span>
            </div>
            <div className="about-copy">
              <p className="kicker"><span className="kicker-line" /> PRAZER, THAYNAN!</p>
              <h2 id="about-title">Um projeto feito<br />com propósito e curiosidade.</h2>
              <p className="about-intro">Sou Thaynan Dias, desenvolvedor Full Stack em formação e estagiário na T4E.</p>
              <p>Criei o Quiz Bíblico para juntar duas coisas que me animam: tecnologia e aprendizado. A ideia é explorar histórias e conhecimentos bíblicos de um jeito leve, interativo e com cara de jogo.</p>
              <div className="about-tags" aria-label="Tecnologias do projeto">
                <span>React</span><span>Django</span><span>IA generativa</span>
              </div>
              <button className="about-play-link" onClick={() => { setScreen('theme'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Bora jogar?
              </button>
            </div>
          </div>
        </section>
      )}

      {['theme', 'difficulty', 'quantity'].includes(screen) && !loading && (
        <section className="selection-screen page-width">
          <Trail active={activeStep} onBack={backFrom} />

          {screen === 'theme' && (
            <div className="selection-content">
              <div className="section-heading">
                <p className="kicker"><span className="kicker-line" /> MISSÃO 01 · ESCOLHA SEU MAPA</p>
                <h1>Qual aventura é a sua?</h1>
                <p>Escolha um tema ou deixe a sorte decidir.</p>
              </div>
              <div className="theme-grid">
                {THEMES.map((item) => (
                  <button className={`theme-option ${item.featured ? 'is-featured' : ''} ${tema === item.name ? 'is-selected' : ''}`} key={item.name} onClick={() => { setTema(item.name); setScreen('difficulty'); }}>
                    <span className={`theme-mark ${item.tone}`} aria-hidden="true">{item.mark}</span>
                    <span className="theme-copy"><b>{item.name}</b><small>{item.note}</small></span>
                  </button>
                ))}
              </div>
              <button className="text-button back-home" onClick={voltarInicio}>Voltar ao início</button>
            </div>
          )}

          {screen === 'difficulty' && (
            <div className="selection-content narrow-content">
              <div className="section-heading">
                <p className="kicker"><span className="kicker-line" /> MISSÃO 02 · {tema}</p>
                <h1>Escolha seu nível.</h1>
                <p>Acerte nas missões para liberar as próximas fases.</p>
              </div>
              <div className="difficulty-list">
                {DIFFICULTIES.map((item) => {
                  const locked = totalXp < item.unlockXp;
                  return <button className={`difficulty-option ${dificuldade === item.value ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`} key={item.value} onClick={() => { setDificuldade(item.value); setScreen('quantity'); }} disabled={locked}>
                    <span className={`difficulty-mark ${item.tone}`} aria-hidden="true">{item.mark}</span>
                    <span className="difficulty-copy"><b>{item.label}</b><small>{locked ? `Faltam ${item.unlockXp - totalXp} XP para liberar` : item.detail}</small></span>
                    {locked && <span className="difficulty-lock" aria-hidden="true">🔒</span>}
                  </button>;
                })}
              </div>
            </div>
          )}

          {screen === 'quantity' && (
            <div className="selection-content quantity-content">
              <div className="section-heading">
                <p className="kicker"><span className="kicker-line" /> MISSÃO 03 · {tema}</p>
                <h1>Quantas fases vai encarar?</h1>
                <p>Mais perguntas, mais XP. Escolha o tamanho da rodada.</p>
              </div>
              <div className="quantity-grid">
                {QUANTITIES.map((quantity) => (
                  <button className="quantity-option" key={quantity} onClick={() => iniciarQuiz(quantity)} disabled={loading}>
                    <strong>{quantity}</strong><span>{quantity === 1 ? 'pergunta' : 'perguntas'}</span>
                    <small className="quantity-xp">ATÉ {quantity * 100} XP</small>
                  </button>
                ))}
              </div>
              <p className="quantity-note"><span aria-hidden="true">⚡</span> Acerte e acumule XP para subir no mapa.</p>
            </div>
          )}
        </section>
      )}

      {loading && (
        <section className="loading-screen page-width" aria-live="polite">
          <div className="loading-art" aria-hidden="true"><i /><i /><i /></div>
          <p className="kicker"><span className="kicker-line" /> CARREGANDO MISSÃO</p>
          <h1>Preparando o desafio<br />e embaralhando as cartas.</h1>
          <p>Segura aí. Sua aventura já vai começar!</p>
        </section>
      )}

      {screen === 'quiz' && !loading && currentQuestion && (
        <section className="quiz-screen page-width">
          <Trail active={3} onBack={backFrom} />
          <div className="quiz-meta"><span>🗺️ {tema}</span><span>⚡ {DIFFICULTIES.find((item) => item.value === dificuldade)?.label}</span><span>+100 XP por acerto</span></div>
          <div className="round-score">
            <div className="round-score-copy"><span>XP ao concluir</span><strong>+{roundCorrectCount * XP_PER_CORRECT_ANSWER} XP</strong>{currentStreak >= 3 && <span className="combo-tag">Combo x{currentStreak}</span>}</div>
            <div className="round-score-track" role="progressbar" aria-label="Acertos nesta rodada" aria-valuenow={roundCorrectCount} aria-valuemin={0} aria-valuemax={perguntas.length}><span style={{ width: `${(roundCorrectCount / perguntas.length) * 100}%` }} /></div>
          </div>
          <div className="quiz-progress-copy"><span>FASE {String(currentIndex + 1).padStart(2, '0')} <b>de {String(perguntas.length).padStart(2, '0')}</b></span><span>{answeredCount} / {perguntas.length} respondidas</span></div>
          <div className="question-progress" role="progressbar" aria-label="Progresso do quiz" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={perguntas.length}>
            {perguntas.map((question, index) => <span className={`${index <= currentIndex ? 'is-current' : ''} ${respostas[question.id] ? 'is-answered' : ''}`} key={question.id} />)}
          </div>
          <article className="question-panel" key={currentQuestion.id}>
            <div className="question-number"><span>⚡</span> DESAFIO DA VEZ</div>
            <h1>{currentQuestion.pergunta}</h1>
            <fieldset className="answer-list">
              <legend className="sr-only">Escolha uma resposta</legend>
              {currentQuestion.opcoes.map((option, index) => {
                const selected = currentAnswer === option;
                const correct = Boolean(currentAnswer) && isCorrectAnswer(currentQuestion, option);
                return (
                  <label className={`answer-option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${selected && !correct && currentAnswer ? 'is-incorrect' : ''} ${currentAnswer ? 'is-revealed' : ''}`} key={`${currentQuestion.id}-${index}`}>
                    <input type="radio" name={`question-${currentQuestion.id}`} checked={selected} onChange={() => marcarResposta(currentQuestion.id, option)} disabled={Boolean(currentAnswer)} />
                    <span className="answer-letter">{LETTERS[index]}</span>
                    <span className="answer-text">{cleanOption(option)}</span>
                    <span className="answer-indicator" aria-hidden="true">{correct ? '✓' : selected && currentAnswer ? '×' : ''}</span>
                  </label>
                );
              })}
            </fieldset>
            {currentAnswer && (
              <div className={`answer-reveal ${currentAnswerIsCorrect ? 'is-correct' : 'is-incorrect'}`} role="status">
                <span className="answer-reveal-mark" aria-hidden="true">{currentAnswerIsCorrect ? '✓' : '×'}</span>
                <div className="answer-reveal-copy">
                  <strong>{currentAnswerIsCorrect ? 'Acertou!' : `Quase! Era ${cleanOption(currentQuestion.resposta_correta)}.`}</strong>
                  <p>{currentQuestion.explicacao || 'Guarde essa resposta para a próxima rodada.'}</p>
                </div>
                {currentAnswerIsCorrect && <span className="answer-xp">+100 XP</span>}
              </div>
            )}
          </article>
          <div className="quiz-controls">
            <button className="text-button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>Anterior</button>
            {currentIndex < perguntas.length - 1 ? (
              <button className="primary-button" onClick={() => setCurrentIndex((index) => Math.min(perguntas.length - 1, index + 1))} disabled={!respostas[currentQuestion.id]}>Próxima pergunta</button>
            ) : (
              <button className="primary-button" onClick={finalizarQuiz} disabled={answeredCount !== perguntas.length}>Ver meu resultado</button>
            )}
          </div>
          {!currentAnswer && <p className="answer-hint">Escolha uma resposta para liberar a próxima fase.</p>}
        </section>
      )}

      {screen === 'result' && resultado && (
        <section className="result-screen page-width">
          <div className="result-heading">
            <p className="kicker"><span className="kicker-line" /> MISSÃO CONCLUÍDA</p>
            <h1>{resultMessage}</h1>
          </div>
          <div className="result-rewards">
            <div className="reward-badge" aria-hidden="true">🏆</div>
            <div><span>SEU NÍVEL</span><strong>{currentLevel.label}</strong></div>
            <div className="reward-divider" />
            <div className="xp-reward"><span>XP GANHO</span><strong>⚡ {resultado.xpEarned}</strong></div>
          </div>
          <div className="result-overview">
            <div className="result-score"><span className="score-label">Sua pontuação</span><div><strong>{resultado.pontuacao}</strong><span> / {perguntas.length}</span></div></div>
            <div className="score-track" role="progressbar" aria-label="Sua pontuação" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
            <p>{percent === 100 ? 'Você acertou todas as perguntas.' : `Você acertou ${resultado.pontuacao} de ${perguntas.length} perguntas.`}</p>
          </div>
          <div className="feedback-heading"><h2>Revise suas respostas</h2><span>{tema}</span></div>
          <div className="feedback-list">
            {resultado.feedbacks.map((feedback, index) => (
              <article className={`feedback-item ${feedback.acertou ? 'was-correct' : 'was-wrong'}`} key={`${index}-${feedback.pergunta}`}>
                <div className="feedback-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="feedback-copy"><h3>{feedback.pergunta}</h3><p className="feedback-answer"><span>{feedback.acertou ? 'Sua resposta' : 'Você marcou'}</span> {feedback.resposta_marcada}</p>{!feedback.acertou && <p className="feedback-answer correct-answer"><span>Resposta correta</span> {feedback.resposta_correta}</p>}{feedback.explicacao && <p className="feedback-explanation">{feedback.explicacao}</p>}</div>
                <span className="feedback-status">{feedback.acertou ? 'Acertou ✓' : 'Revisar'}</span>
              </article>
            ))}
          </div>
          <div className="result-actions"><button className="primary-button" onClick={reiniciar}>Escolher outra jornada</button><button className="text-button" onClick={voltarInicio}>Voltar ao início</button></div>
        </section>
      )}

      <footer className="site-footer"><span>Quiz Bíblico</span><span>Uma pergunta de cada vez.</span>{screen === 'intro' && <a href="#about">Sobre o criador</a>}</footer>
    </main>
  );
}

export default App;
