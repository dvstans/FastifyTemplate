document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("btn-logout").addEventListener("click", function(){
        location.href = "/auth/app/ui/logout";
    });

    document.getElementById("btn-welcome").addEventListener("click", function(){
        location.href = "/app/ui/welcome";
    });

    document.getElementById("btn-who").addEventListener("click", function(){
        fetch( '/auth/api/who', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-token-show").addEventListener("click", function(){
        fetch( '/auth/api/token/show', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        })
    });

    document.getElementById("btn-user-list").addEventListener("click", function(){
        fetch( '/auth/api/user/list', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-user-view").addEventListener("click", function(){
        fetch( '/auth/api/user/view?uid=1234', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-user-list-bad").addEventListener("click", function(){
        fetch( '/auth/api/user/list?offset=abc&limit=-1&collab=QQQ', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-user-view-bad").addEventListener("click", function(){
        fetch( '/auth/api/user/view', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-proj-list").addEventListener("click", function(){
        fetch( '/auth/api/project/list', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });

    document.getElementById("btn-proj-view").addEventListener("click", function(){
        fetch( '/auth/api/project/view?pid=1234', { cache: "no-store" }).then( function( _resp ){
            return _resp.text();
        })
        .then( function( _data ){
            document.getElementById("div-output").textContent = _data;
        });
    });
}, false);

