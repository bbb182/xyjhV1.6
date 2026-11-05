/* 星星故事：学生卡片 + 成长时间轴 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var U = window.XYUtil;
  var $ = U.$;

  var listBox = $("#storiesList");
  var chipsBox = $("#storyChips");
  if(!listBox || !chipsBox) return;

  var active = new URLSearchParams(location.search).get("s") || "all";

  chipsBox.innerHTML =
    '<button class="chip'+(active==="all"?" active":"")+'" data-s="all">全部故事</button>' +
    X.students.map(function(s){
      return '<button class="chip'+(active===s.id?" active":"")+'" data-s="'+s.id+'">'+s.nick+'</button>';
    }).join("");

  chipsBox.addEventListener("click", function(e){
    var btn = e.target.closest(".chip");
    if(!btn) return;
    active = btn.getAttribute("data-s");
    chipsBox.querySelectorAll(".chip").forEach(function(b){ b.classList.toggle("active", b===btn); });
    render();
  });

  var tlColors = ["var(--blue)","var(--lav-deep)","var(--yellow-deep)","var(--green-deep)","var(--rose)"];
  var tlBg = ["#EAF2FA","#F1EDFA","#FDF3DC","#EBF4EE","#FBEFF2"];

  function render(){
    var students = X.students.filter(function(s){ return active==="all" || s.id===active; });
    listBox.innerHTML = students.map(function(s){
      var works = X.works.filter(function(w){ return w.studentId === s.id; });
      var tl = s.milestones.map(function(m, i){
        return (
          '<div class="timeline-item" style="--t-color:'+tlColors[i%5]+';--t-bg:'+tlBg[i%5]+'">'+
            '<div class="tl-date">'+m.date+'</div>'+
            '<h4>'+U.esc(m.title)+'</h4>'+
            '<p>'+U.esc(m.desc)+'</p>'+
            (works[i] ? '<img class="tl-img" src="'+works[i].cover+'" alt="'+U.esc(works[i].title)+'">' : '')+
          '</div>'
        );
      }).join("");
      return (
        '<div class="student-story" id="student-'+s.id+'">'+
          '<aside class="student-card">'+
            '<div class="cover" style="--s1:'+s.c1+';--s2:'+s.c2+'">'+
              '<img src="'+s.avatar+'" alt="'+s.nick+'">'+
            '</div>'+
            '<div class="body">'+
              '<h3>'+s.nick+'</h3>'+
              '<div class="who">'+s.age+'岁 · '+s.city+' · '+s.direction+'</div>'+
              '<div class="quote">“'+s.quote+'”</div>'+
              '<div class="tag-line">'+
                s.tags.map(function(t){ return '<span class="tag blue">'+t+'</span>'; }).join("")+
              '</div>'+
              '<div style="margin-top:16px;font-size:12.5px;color:var(--ink-3)">原创作品 '+works.length+' 件</div>'+
            '</div>'+
          '</aside>'+
          '<div class="timeline">'+tl+'</div>'+
        '</div>'
      );
    }).join("");

    /* 从 hash 定位到对应学生 */
    var hash = location.hash;
    if(hash && hash.indexOf("student-") === 1){
      var el = document.querySelector(hash);
      if(el){
        setTimeout(function(){
          el.scrollIntoView({behavior:"smooth", block:"start"});
          el.style.transition = "box-shadow .5s";
          el.style.boxShadow = "0 0 0 5px rgba(246,196,83,.45)";
          setTimeout(function(){ el.style.boxShadow = ""; }, 2000);
        }, 300);
      }
    }
  }

  render();
})();
