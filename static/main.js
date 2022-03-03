document.getElementById("btn-logout").addEventListener("click", function(){
    location.href = "/auth/app/ui/logout";
});

document.getElementById("btn-welcome").addEventListener("click", function(){
    location.href = "/app/ui/welcome";
});

document.getElementById("btn-who").addEventListener("click", function(){
    fetch( '/auth/api/user/who?details="xxx"', { cache: "no-store" }).then( function( a_resp ){
        return a_resp.text();
    })
    .then( function( a_data ){
        document.getElementById("div-output").textContent = a_data;
    });
});

document.getElementById("btn-something").addEventListener("click", function(){
    fetch( '/auth/api/something', { cache: "no-store" }).then( function( a_resp ){
        return a_resp.text();
    })
    .then( function( a_data ){
        document.getElementById("div-output").textContent = a_data;
    });
});

document.getElementById("btn-token-show").addEventListener("click", function(){
    fetch( '/auth/app/api/token', { cache: "no-store" }).then( function( a_resp ){
        return a_resp.text();
    })
    .then( function( a_data ){
        document.getElementById("div-output").textContent = a_data;
    })
});

