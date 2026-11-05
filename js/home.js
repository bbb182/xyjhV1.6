/* 首页渲染 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  /* 项目理念 */
  var pillars = $("#pillars");
  if(pillars){
    pillars.innerHTML = X.pillars.map(function(p){
      return (
        '<div class="pillar-card" style="--pillar-bg:'+p.bg+'">'+
          '<div class="pillar-icon">'+p.icon+'</div>'+
          '<h3>'+p.name+'</h3>'+
          '<p>'+p.desc+'</p>'+
        '</div>'
      );
    }).join("");
  }

  /* 公益闭环 */
  var flow = $("#flowSteps");
  if(flow){
    flow.innerHTML = X.flow.map(function(f){
      return (
        '<div class="flow-step">'+
          '<div class="flow-num">'+f.no+'</div>'+
          '<h3>'+f.name+'</h3>'+
          '<p>'+f.desc+'</p>'+
        '</div>'
      );
    }).join("");
  }

  /* 热门作品 */
  var hot = $("#hotWorks");
  if(hot){
    hot.innerHTML = X.works.slice(0,6).map(U.workCardHTML).join("");
  }

  /* 星星故事预览：真实姓名 + 12 岁以内 + 太原，不展示方向与标签 */
  var sp = $("#storyPreview");
  if(sp){
    var pick = ["s6","s2","s1"];
    var colorMap = { s6:"var(--green-deep)", s2:"var(--lav-deep)", s1:"var(--blue)" };
    sp.innerHTML = pick.map(function(id){
      var s = U.getStudent(id);
      if(!s) return "";
      return (
        '<a class="story-preview-card" href="stories.html#student-'+s.id+'" style="--s-color:'+colorMap[id]+'">'+
          '<div class="story-avatar">'+
            '<img src="'+s.avatar+'" alt="'+s.nick+'">'+
            '<div><b>'+s.nick+'</b><span>'+s.age+'岁 · '+s.city+'</span></div>'+
          '</div>'+
          '<p>'+s.bio+'</p>'+
        '</a>'
      );
    }).join("");
  }

  /* 数据展示 */
  var stats = $("#statsBand");
  if(stats){
    stats.innerHTML =
      '<div class="stats-grid">'+
        X.stats.map(function(s){
          return (
            '<div class="stat-card">'+
              '<b><span data-count="'+s.value+'" data-suffix="'+s.suffix+'">'+s.value+s.suffix+'</span></b>'+
              '<span>'+s.label+'</span>'+
            '</div>'
          );
        }).join("")+
      '</div>';
  }
})();
