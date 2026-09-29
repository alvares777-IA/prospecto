// Tela de fim de jogo, comum aos jogos arcade (Paddle, Comilão, Cobrinha,
// Invasores, TIM). O jogo NÃO envia a pontuação sozinho ao terminar: mostra
// o resultado e o jogador escolhe "Enviar pontos e voltar" ou "Jogar de novo".
// Quem decide se resolveu continua sendo o servidor (a resposta volta como
// mensagem 'resultado' e é repassada aqui por FimJogo.resultado).
(function () {
    let el = null, opcoes = null;

    function estilo() {
        if (document.getElementById('fim-jogo-estilo')) return;
        const s = document.createElement('style');
        s.id = 'fim-jogo-estilo';
        s.textContent = `
          .fj-fundo{position:fixed;inset:0;background:rgba(6,10,26,.78);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}
          .fj-cartao{background:#111a33;border:1px solid #1e2a45;border-radius:14px;padding:22px 26px;max-width:380px;width:100%;text-align:center;
                     box-shadow:0 20px 50px rgba(0,0,0,.5);font-family:system-ui,Segoe UI,Arial,sans-serif;color:#e2e8f0}
          .fj-icone{font-size:40px;line-height:1;margin-bottom:6px}
          .fj-titulo{font-size:20px;font-weight:700;margin:0 0 4px}
          .fj-detalhe{font-size:13px;color:#94a3b8;margin:0 0 12px}
          .fj-pontos{font-size:34px;font-weight:800;color:#facc15;margin:4px 0}
          .fj-meta{font-size:13px;color:#cbd5e1;margin-bottom:10px}
          .fj-status{font-size:13px;font-weight:600;min-height:18px;margin-bottom:14px}
          .fj-status.ok{color:#22c55e}.fj-status.alerta{color:#f59e0b}.fj-status.erro{color:#ef4444}
          .fj-botoes{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
          .fj-botoes button{border:0;border-radius:8px;padding:9px 16px;font-size:14px;cursor:pointer;color:#fff;background:#1d4ed8}
          .fj-botoes button.fj-sec{background:#334155}
          .fj-botoes button:disabled{opacity:.55;cursor:default}`;
        document.head.appendChild(s);
    }

    function mostrar(o) {
        opcoes = o;
        estilo();
        esconder();
        const bateu = o.pontos >= o.meta;
        el = document.createElement('div');
        el.className = 'fj-fundo';
        el.innerHTML = `
          <div class="fj-cartao" role="dialog" aria-modal="true">
            <div class="fj-icone">${o.venceu ? '🏆' : '🎮'}</div>
            <p class="fj-titulo"></p>
            <p class="fj-detalhe"></p>
            <div class="fj-pontos">${o.pontos}</div>
            <div class="fj-meta">pontos · meta ${o.meta}</div>
            <div class="fj-status"></div>
            <div class="fj-botoes">
              <button type="button" class="fj-enviar">Enviar pontos e voltar</button>
              <button type="button" class="fj-sec fj-repetir">Jogar de novo</button>
            </div>
          </div>`;
        el.querySelector('.fj-titulo').textContent = o.titulo || (o.venceu ? 'Jogo completado!' : 'Fim de jogo');
        el.querySelector('.fj-detalhe').textContent = o.detalhe || '';
        const $st = el.querySelector('.fj-status'), $env = el.querySelector('.fj-enviar');
        if (!o.embutido) {
            $env.disabled = true;
            status('Abra pelo jogoDaVida para os pontos valerem.', 'alerta');
        } else if (bateu) {
            status('✓ Bateu a meta!', 'ok');
        } else {
            status(`Faltam ${o.meta - o.pontos} pontos. Enviar abaixo da meta custa energia.`, 'alerta');
            $env.textContent = 'Enviar mesmo assim';
        }
        $env.onclick = () => {
            $env.disabled = true; el.querySelector('.fj-repetir').disabled = true;
            status('Enviando…', 'ok');
            o.aoEnviar();
        };
        el.querySelector('.fj-repetir').onclick = () => { esconder(); o.aoRepetir(); };
        document.body.appendChild(el);
        setTimeout(() => (o.embutido ? $env : el.querySelector('.fj-repetir')).focus(), 50);

        function status(t, tipo) { $st.className = 'fj-status ' + tipo; $st.textContent = t; }
    }

    // resposta do servidor, repassada pela página
    function resultado(correto) {
        if (!el) return;
        const $st = el.querySelector('.fj-status');
        if (correto) {
            $st.className = 'fj-status ok';
            $st.textContent = '✓ Pontos enviados! Voltando…';
        } else {
            $st.className = 'fj-status erro';
            $st.textContent = 'Não atingiu a meta. Jogue de novo para tentar mais pontos.';
            const $rep = el.querySelector('.fj-repetir');
            $rep.disabled = false; $rep.focus();
        }
    }

    function esconder() { if (el) { el.remove(); el = null; } }
    const aberta = () => !!el;

    window.FimJogo = { mostrar, resultado, esconder, aberta };
})();
