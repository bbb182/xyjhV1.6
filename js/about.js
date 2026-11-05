/* 项目介绍：渲染合作伙伴 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var box = document.getElementById("partnerList");
  if(!box) return;
  box.innerHTML = X.partners.map(function(p){
    return (
      '<div class="partner-item">'+
        '<div class="p-icon">'+p.icon+'</div>'+
        '<b>'+p.name+'</b>'+
        '<span>'+p.role+'</span>'+
      '</div>'
    );
  }).join("");
})();
