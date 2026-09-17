/* 入口：初始化存储、绑定导航、渲染首屏 */
(function () {
  Store.load();
  UI.bindGlobal();
  Views.renderMini();

  const hash = location.hash.replace('#', '');
  const initial = Views.renderers[hash] ? hash : 'dashboard';
  UI.switchView(initial);

  window.__onDataChange = function () {
    Views.refreshCurrent();
  };

  // 示例数据提示（仅首次加载且为示例数据时）
  if (Store.state.meta && Store.state.meta.sample) {
    setTimeout(function () {
      UI.toast('已载入示例数据供预览，可在「数据管理」中清空或重新载入', 'ok');
    }, 600);
  }

  // 自动健康预警：出现恢复风险时弹窗（每天最多一次），已授权时发送系统通知
  setTimeout(function () {
    if (Views.checkHealthAlert) Views.checkHealthAlert();
  }, 900);
})();
