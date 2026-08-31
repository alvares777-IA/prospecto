
$(function(){
  const answer = document.body.dataset.answer;
  const mode = document.body.dataset.mode;
  let solved=false;

  function normalize(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  function success(){
    if(solved)return; solved=true;
    $('#feedback').removeClass('text-danger').addClass('text-success').text('✓ Correto! Enigma solucionado.');
    $('#answerBox').addClass('border-success');
    $('#nextBtn').removeClass('d-none');
    // ponte com o jogoDaVida: quando embutido num <iframe>, avisa o jogo.
    try{ if(window.parent && window.parent!==window) window.parent.postMessage({tipo:'enigma_resolvido',resposta:answer},'*'); }catch(e){}
  }
  function fail(){ $('#feedback').removeClass('text-success').addClass('text-danger').text('✗ Ainda não. Tente novamente.'); }

  $('#checkBtn').on('click',function(){
    const v=$('#answerInput').val();
    if(normalize(v)===normalize(answer) || normalize(answer).includes(normalize(v)) && normalize(v).length>=3) success(); else fail();
  });
  $('#answerInput').on('keydown',e=>{if(e.key==='Enter')$('#checkBtn').click()});

  $('.option').on('click',function(){
    if(normalize($(this).data('answer'))===normalize(answer)){ $(this).addClass('correct'); success(); }
    else {$(this).addClass('wrong'); fail();}
  });

  $('.draggable').on('dragstart',function(e){e.originalEvent.dataTransfer.setData('text/plain',$(this).data('value'));});
  $('#answerBox').on('dragover',function(e){e.preventDefault();$(this).addClass('over');})
    .on('dragleave',function(){$(this).removeClass('over');})
    .on('drop',function(e){
      e.preventDefault();$(this).removeClass('over');
      const v=e.originalEvent.dataTransfer.getData('text/plain');
      $('#answerInput').val(v); $('#checkBtn').click();
    });
});
