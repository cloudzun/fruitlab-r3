(function bootGuard() {
  "use strict";

  window.__fruitlabBooted = false;

  function showBootFailure() {
    if (window.__fruitlabBooted) return;
    var status = document.getElementById("boot-status");
    if (status) status.textContent = "页面加载失败，请刷新重试";
    document.documentElement.classList.add("boot-failed");
    var controls = document.querySelectorAll("[data-requires-js]");
    for (var index = 0; index < controls.length; index += 1) {
      controls[index].disabled = true;
    }
  }

  window.__fruitlabShowBootFailure = showBootFailure;
  window.addEventListener("error", showBootFailure, true);
  window.addEventListener("unhandledrejection", showBootFailure);
}());
