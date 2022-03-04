document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("btn-login").addEventListener("click", function(){
        location.href = "/app/ui/login";
    });

    console.log("welcome.js loaded");
}, false);

