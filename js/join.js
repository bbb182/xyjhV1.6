/* 加入我们：角色卡片 + 表单 */
(function(){
  var X = window.XINGYU;
  if(!X) return;
  var $ = window.XYUtil.$;

  /* 角色卡片 */
  var roles = $("#roleGrid");
  if(roles){
    roles.innerHTML = X.roles.map(function(r){
      return (
        '<div class="role-card">'+
          '<div class="role-icon" style="--r-bg:'+r.color+'">'+r.icon+'</div>'+
          '<h3>'+r.name+'</h3>'+
          '<p>'+r.desc+'</p>'+
          '<div class="need">需要：'+r.need+'</div>'+
          '<button class="btn btn-ghost btn-sm" data-type="'+r.name+'">立即加入</button>'+
        '</div>'
      );
    }).join("");
    roles.addEventListener("click", function(e){
      var btn = e.target.closest("[data-type]");
      if(!btn) return;
      var sel = $("#jfType");
      if(sel){
        var type = btn.getAttribute("data-type");
        var opt = Array.prototype.slice.call(sel.options).filter(function(o){ return o.value.indexOf(type) === 0; })[0];
        if(opt) sel.value = opt.value;
      }
      $("#joinForm").scrollIntoView({behavior:"smooth", block:"center"});
      $("#jfName").focus();
    });
  }

  /* 表单类型 */
  var sel = $("#jfType");
  if(sel){
    sel.innerHTML = X.joinForm.types.map(function(t){
      return '<option value="'+t+'">'+t+'</option>';
    }).join("");
  }

  /* 提交：接入数据库（/api/applications），离线时回退为演示提示 */
  var form = $("#joinForm");
  if(form){
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var name = $("#jfName").value.trim();
      var contact = $("#jfContact").value.trim();
      var type = $("#jfType").value;
      if(!name || !contact){ window.toast("请填写称呼与联系方式"); return; }

      var payload = {
        name: name,
        contact: contact,
        type: type,
        org: ($("#jfOrg") || {}).value ? $("#jfOrg").value.trim() : "",
        message: ($("#jfMsg") || {}).value ? $("#jfMsg").value.trim() : ""
      };

      var btn = form.querySelector('button[type="submit"]');
      var api = window.XYAPI;
      if(!api || !api.online){
        window.toast("提交成功！我们会在 3 个工作日内联系你 ✨");
        form.reset();
        return;
      }

      if(btn){ btn.disabled = true; btn.textContent = "提交中…"; }
      api.createApplication(payload).then(function(res){
        window.toast("提交成功（编号 #" + res.id + "），我们会在 3 个工作日内联系你 ✨");
        form.reset();
      }).catch(function(err){
        window.toast(err && err.message ? err.message : "提交失败，请稍后再试");
      }).then(function(){
        if(btn){ btn.disabled = false; btn.textContent = "提交申请"; }
      });
    });
  }
})();
