
// A página NÃO conhece a resposta. Ela só coleta a escolha do jogador e a
// manda para o jogoDaVida (via <iframe>/postMessage); quem valida é o servidor.
// Aberta fora do jogo, não há como confirmar acerto.
$(function () {
  const embutido = window.parent && window.parent !== window;
  let done = false, enviado = null;

  function feedback(t, ok) {
    $('#feedback').removeClass('text-success text-danger')
      .addClass(ok ? 'text-success' : 'text-danger').text(t);
  }

  function enviar(valor) {
    if (done) return;
    enviado = valor;
    if (embutido) {
      try { window.parent.postMessage({ tipo: 'tentativa', valor: valor }, location.origin); } catch (e) {}
    } else {
      feedback('Abra este enigma pelo jogoDaVida para valer.', false);
    }
  }

  // resultado vindo do jogo
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.tipo !== 'resultado') return;
    if (d.correto) {
      done = true;
      feedback('✓ Correto! Enigma solucionado.', true);
      $('#answerBox').addClass('border-success');
      $('#nextBtn').removeClass('d-none');
      $('.option').each(function () {
        const v = $(this).data('answer') ?? $(this).data('value');
        if (String(v) === String(enviado)) $(this).addClass('correct');
      });
    } else {
      feedback('✗ Ainda não. Tente novamente.', false);
      $('.option').removeClass('wrong').each(function () {
        const v = $(this).data('answer') ?? $(this).data('value');
        if (String(v) === String(enviado)) $(this).addClass('wrong');
      });
    }
  });

  $('#checkBtn').on('click', function () { enviar($('#answerInput').val() || ''); });
  $('#answerInput').on('keydown', function (e) { if (e.key === 'Enter') $('#checkBtn').click(); });

  $('.option').on('click', function () { enviar($(this).data('answer')); });

  $('.draggable').on('dragstart', function (e) {
    e.originalEvent.dataTransfer.setData('text/plain', $(this).data('value'));
  });
  $('#answerBox').on('dragover', function (e) { e.preventDefault(); $(this).addClass('over'); })
    .on('dragleave', function () { $(this).removeClass('over'); })
    .on('drop', function (e) {
      e.preventDefault(); $(this).removeClass('over');
      const v = e.originalEvent.dataTransfer.getData('text/plain');
      $('#answerInput').val(v); enviar(v);
    });
});
