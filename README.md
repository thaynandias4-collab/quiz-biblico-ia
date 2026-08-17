# 📖 Quiz Bíblico com Inteligência Artificial

Uma aplicação Full-Stack interativa que gera perguntas bíblicas de forma dinâmica utilizando a Inteligência Artificial do Google Gemini. O sistema foi desenhado visando escalabilidade, separação clara de responsabilidades e código limpo.

🌐 **Acesse o projeto online: https://quiz-biblico-ia-fios.vercel.app/

## 🛠 Tecnologias Utilizadas

Este projeto segue os padrões arquiteturais de aplicações modernas:

**Back-end:**
*   **Python & Django:** Utilizado para construir uma API robusta, com clara separação entre models, views e urls.
*   **Google Gemini API:** Integração com LLM para geração inteligente e contextualizada do quiz.

**Front-end:**
*   **React (via Vite):** Construção de uma interface de usuário responsiva, baseada em componentes reutilizáveis e com gerenciamento de estado eficiente.

**Infraestrutura & Qualidade:**
*   **Docker:** O projeto é conteinerizado, permitindo que a aplicação completa suba com um único comando `docker-compose up`.
*   **Testes:** Configurado para receber testes com `pytest` (Backend) e `Jest` (Frontend).

## ⚙️ Como executar o projeto localmente

### Pré-requisitos
*   [Docker e Docker Compose](https://www.docker.com/) instalados na sua máquina.
*   Uma chave de API válida do [Google AI Studio](https://aistudio.google.com/app/apikey).

### Passo a passo

1. **Clone o repositório**
   ```bash
   git clone [https://github.com/SEU_USUARIO/quiz-biblico-ia.git](https://github.com/SEU_USUARIO/quiz-biblico-ia.git)
   cd quiz-biblico-ia


   Autor do projeto: 
   Thaynan Willian Dias
   Desenvolvedor Fullstack
   Estudante ADS- 2° Semestre - Facens
