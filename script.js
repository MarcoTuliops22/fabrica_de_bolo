// Array para armazenar os pedidos e logs (no LocalStorage para persistência)
let pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
let sistemaLogs = JSON.parse(localStorage.getItem('sistemaLogs')) || [];

// Função utilitária para registrar eventos no diário de bordo
function adicionarLog(mensagem) {
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR');
    
    const novoLog = {
        hora: horaFormatada,
        mensagem: mensagem
    };

    // Adiciona no início do array para o mais recente ficar no topo
    sistemaLogs.unshift(novoLog);
    
    // Mantém no máximo os últimos 50 logs para não pesar
    if (sistemaLogs.length > 50) {
        sistemaLogs.pop();
    }

    localStorage.setItem('sistemaLogs', JSON.stringify(sistemaLogs));
    
    // Se o container de log existir na tela atual (admin.html), já atualiza
    renderizarLogs();
}

function renderizarLogs() {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return; // Só executa se estiver na página de admin

    logContainer.innerHTML = '';

    if (sistemaLogs.length === 0) {
        logContainer.innerHTML = '<p>Nenhum evento registrado ainda.</p>';
        return;
    }

    sistemaLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = `<span class="log-time">[${log.hora}]</span> ${log.mensagem}`;
        logContainer.appendChild(div);
    });
}

// ========== AUTENTICAÇÃO E PERFIS ==========
const usuariosPadrao = [
    { usuario: 'motorista', senha: '123', tipo: 'motorista' }
];
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || usuariosPadrao;

function cadastrarUsuario() {
    const usuario = document.getElementById('usuario-cad').value.trim();
    const senha = document.getElementById('senha-cad').value.trim();
    const tipo = document.getElementById('tipo-cad').value;

    if (!usuario || !senha) {
        alert("Preencha todos os campos!");
        return;
    }

    if (usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())) {
        alert("Este usuário já existe, escolha outro nome ou faça login.");
        return;
    }
    
    // Trava do Backend: Impede criar outro admin se já existir um
    if (tipo === 'admin') {
        const algumAdminExiste = usuarios.find(u => u.tipo === 'admin');
        if (algumAdminExiste) {
            alert("Já existe um administrador cadastrado no sistema. Não é possível criar outro.");
            return;
        }
    }

    usuarios.push({ usuario, senha, tipo });
    // Salva a lista atualizada de usuários no localStorage
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    alert("Conta criada com sucesso! Faça seu login.");
    alternarTela('login');
}

function fazerLogin() {
    const usuarioDigitado = document.getElementById('usuario-login').value.trim();
    const senhaDigitada = document.getElementById('senha-login').value.trim();
    
    // Procura o usuário no array salvo
    const user = usuarios.find(u => u.usuario === usuarioDigitado && u.senha === senhaDigitada);

    if (user) {
        if (user.tipo === 'admin') {
            sessionStorage.setItem("adminAuth", "true");
            window.location.href = "admin.html";
        } else if (user.tipo === 'motorista') {
            sessionStorage.setItem("motoAuth", "true");
            window.location.href = "motorista.html";
        } else if (user.tipo === 'cliente') {
            sessionStorage.setItem("clienteAuth", "true");
            sessionStorage.setItem("nomeClienteLogado", user.usuario);
            window.location.href = "cliente.html"; // Tela de Cliente/Geral
        }
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

function sairSistema() {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("motoAuth");
    sessionStorage.removeItem("clienteAuth");
    sessionStorage.removeItem("nomeClienteLogado");
    // Para o rastreamento se for motorista saindo
    if (watchID) navigator.geolocation.clearWatch(watchID);
    window.location.href = "index.html";
}

// ========== RASTREAMENTO GPS EM TEMPO REAL ==========
let watchID = null;

function iniciarRastreamentoMotorista() {
    if ("geolocation" in navigator) {
        // Opções para alta precisão
        const options = {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        };

        watchID = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const posicao = {
                    lat: latitude,
                    lng: longitude,
                    ultimaAtualizacao: new Date().toISOString()
                };
                localStorage.setItem('posicaoMotorista', JSON.stringify(posicao));
                console.log("🚙 Posição do motorista atualizada:", posicao);
                
                // Se estiver na página do motorista e houver um mapa (opcional futuro), poderia atualizar aqui
            },
            (error) => {
                console.error("Erro no GPS:", error.message);
                // adicionarLog(`ERRO GPS: ${error.message}`);
            },
            options
        );
    } else {
        alert("Seu navegador não suporta geolocalização.");
    }
}

// ========== LÓGICA DO INDEX.HTML ==========
const precosProdutos = {
    'Pão Francês': 0.70,
    'Pão Doce': 1.50,
    'Pão de Forma': 8.00,
    'Bolo': 25.00
};

// Tempos de preparo estimados por produto (em minutos)
const temposPreparo = {
    'Pão Francês': 20,
    'Pão Doce': 40,
    'Pão de Forma': 60,
    'Bolo': 120
};

function selecionarProduto(nomeProduto) {
    const inputProduto = document.getElementById('produto');
    if (inputProduto) {
        inputProduto.value = nomeProduto;
        calcularValorPedido();
    }
}

function calcularValorPedido() {
    const produtoDigitado = document.getElementById('produto').value.trim().toLowerCase();
    const quantidade = parseInt(document.getElementById('quantidade').value) || 0;
    const valorInput = document.getElementById('valor');
    
    // Tabela de preços minúscula para facilitar a busca ignorando maiúsculas
    const precosNorm = {};
    for(let key in precosProdutos) {
        precosNorm[key.toLowerCase()] = precosProdutos[key];
    }
    
    // Calcula apenas se o produto constar na nossa tabela e a quantidade for maior que zero
    if (produtoDigitado && precosNorm[produtoDigitado] && quantidade > 0) {
        const precoUnitario = precosNorm[produtoDigitado];
        const valorTotal = precoUnitario * quantidade;
        valorInput.value = valorTotal.toFixed(2);
    } else if (quantidade === 0 || !quantidade) {
        // Não apaga forçadamente o valor caso o admin queira digitar um preço manual de um produto que não tá na tabela
        // valorInput.value = ''; 
    }
}

// ========== CEP AUTOMÁTICO ==========
function formatarCEP(input) {
    let v = input.value.replace(/\D/g,'');
    if (v.length > 5) v = v.substring(0,5) + '-' + v.substring(5,8);
    input.value = v;
    if (v.replace('-','').length === 8) buscarCEP();
}

function buscarCEP() {
    const cepInput = document.getElementById('cep');
    if (!cepInput) return;
    const cep = cepInput.value.replace(/\D/g,'');
    if (cep.length !== 8) return;
    const endInput = document.getElementById('endereco');
    endInput.value = 'Buscando...';
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(r => r.json())
        .then(d => {
            if (d.erro) {
                endInput.value = '';
                alert('CEP não encontrado. Verifique o número e tente novamente.');
            } else {
                endInput.value = `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}`;
                const numInput = document.getElementById('numero-end');
                if (numInput) numInput.focus();
            }
        })
        .catch(() => { endInput.value = ''; alert('Erro na busca do CEP. Verifique sua internet.'); });
}

async function registrarPedido() {
    const cliente = document.getElementById('cliente').value;
    const produto = document.getElementById('produto').value;
    const quantidade = parseInt(document.getElementById('quantidade').value);
    const caminhao = document.getElementById('caminhao').value;
    const custo = parseFloat(document.getElementById('custo').value);
    const valor = parseFloat(document.getElementById('valor').value);
    const enderecoCEP = document.getElementById('endereco') ? document.getElementById('endereco').value : '';
    const numeroEnd = document.getElementById('numero-end') ? document.getElementById('numero-end').value.trim() : '';
    const endereco = numeroEnd ? `${enderecoCEP}, ${numeroEnd}` : enderecoCEP;

    // Validação básica
    if (!cliente || !produto || isNaN(quantidade) || !caminhao || isNaN(custo) || isNaN(valor) || !endereco) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    const lucro = valor - custo;

    // Buscar latitude e longitude usando OpenStreetMap Nominatim
    let lat = null;
    let lng = null;
    const btnRegistrar = document.querySelector('button[onclick="registrarPedido()"]');
    const textoBotaoOriginal = btnRegistrar.innerText;
    
    try {
        btnRegistrar.innerText = "Buscando endereço...";
        btnRegistrar.disabled = true;

        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`);
        const data = await response.json();

        if (data.length > 0) {
            lat = parseFloat(data[0].lat);
            lng = parseFloat(data[0].lon);
        } else {
            alert("Endereço não encontrado. O pedido será salvo, mas não aparecerá no mapa. Tente ser mais específico, ex: Rua XPTO, Cidade.");
        }
    } catch (error) {
        console.error("Erro ao buscar coordenadas:", error);
        alert("Erro na busca do endereço. O pedido será salvo sem posição no mapa.");
    } finally {
        btnRegistrar.innerText = textoBotaoOriginal;
        btnRegistrar.disabled = false;
    }

    // Gera código secreto de 4 dígitos (1000 a 9999)
    const codigoSecreto = Math.floor(1000 + Math.random() * 9000).toString();

    // Gera a data atual YYYY-MM-DD
    const dataAtual = new Date().toISOString().split('T')[0];

    const novoPedido = {
        id: Date.now().toString(), // Adiciona um ID único para facilitar busca
        data: dataAtual, // Adicionado para filtro de data
        cliente,
        produto,
        quantidade,
        caminhao,
        endereco,
        custo,
        valor,
        lucro,
        lat,
        lng,
        codigoSecreto,
        status: "Preparando", // Preparando, Saiu para Entrega, ou Entregue
        tempoPreparo: temposPreparo[produto] || 30, // Pega da tabela ou 30 min padrão
        previsaoChegada: "" // Será preenchido quando sair para entrega
    };

    pedidos.push(novoPedido);
    localStorage.setItem('pedidos', JSON.stringify(pedidos));

    // REGISTA O LOG
    if (lat && lng) {
        adicionarLog(`NOVO PEDIDO (Cód: ${codigoSecreto}): ${quantidade}x ${produto} para ${cliente} em ${endereco}.`);
    } else {
        adicionarLog(`NOVO PEDIDO Sem Mapa (Cód: ${codigoSecreto}): ${quantidade}x ${produto} para ${cliente} em ${endereco}.`);
    }

    alert(`Pedido registrado com sucesso!\n\nGuarde o código de entrega para o cliente ou motorista: ${codigoSecreto}`);

    // Mostrar o código na tela para o usuário (se quiser rastrear)
    const codigoDisplay = document.getElementById('codigo-gerado-display');
    if (codigoDisplay) {
        codigoDisplay.innerHTML = `Seu código de acompanhamento: <strong>${codigoSecreto}</strong>`;
    }

    // Limpar campos
    document.getElementById('cliente').value = '';
    document.getElementById('produto').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('caminhao').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('custo').value = '';
    document.getElementById('valor').value = '';
}


// ========== LÓGICA DO ADMIN.HTML ==========
function carregarDashboard() {
    // Verifica se estamos na página admin
    if (!document.getElementById('pedidos')) return;

    // Lógica para filtro de datas
    const inputDataInicio = document.getElementById('data-inicio');
    const inputDataFim = document.getElementById('data-fim');
    
    let pedidosFiltrados = pedidos;

    if (inputDataInicio && inputDataInicio.value && inputDataFim && inputDataFim.value) {
        const dataInicio = inputDataInicio.value;
        const dataFim = inputDataFim.value;

        pedidosFiltrados = pedidos.filter(p => {
            // Se o pedido não tem data (pedidos antigos antes da atualização), consideramos a data atual ou deixamos passar
            const dataPedido = p.data || new Date().toISOString().split('T')[0];
            return dataPedido >= dataInicio && dataPedido <= dataFim;
        });
    }

    let totalPedidos = pedidosFiltrados.length;
    let totalVendas = 0;
    let totalLucro = 0;
    let producao = {}; // Objeto para somar as quantidades por produto

    const tabelaEntregas = document.getElementById('tabela');
    tabelaEntregas.innerHTML = '';

    // Array modificado de latLngs para o mapa do admin apenas com filtrados
    let latLngsAdmin = [];

    pedidosFiltrados.forEach(p => {
        totalVendas += p.valor;
        totalLucro += p.lucro;

        // Soma producao
        if (producao[p.produto]) {
            producao[p.produto] += p.quantidade;
        } else {
            producao[p.produto] = p.quantidade;
        }

        // Adiciona na tabela de entregas
        const tr = document.createElement('tr');
        // Define classe CSS dependendo do status
        let corStatus = 'color: orange; font-weight: bold;';
        if (p.status === 'Entregue') corStatus = 'color: green; font-weight: bold;';
        else if (p.status === 'Saiu para Entrega') corStatus = 'color: #3498db; font-weight: bold;';

        let htmlAcoes = '';
        if (p.lat && p.lng) {
            htmlAcoes += `<button onclick="focarNoMapa(${p.lat}, ${p.lng})" style="margin-bottom:5px;">📍 Mapa</button><br>`;
        }
        
        // Novo botão de Chat pro Admin
        htmlAcoes += `<button onclick="abrirChatAdmin('${p.id}')" style="background-color: #9b59b6; margin-bottom:5px;">💬 Chat</button><br>`;
        
        if (p.status === 'Preparando') {
            htmlAcoes += `<button onclick="despacharPedido('${p.id}')" style="background-color: #f39c12; font-size: 12px;">🚚 Despachar</button>`;
        }

        tr.innerHTML = `
            <td>${p.cliente}</td>
            <td>${p.produto}</td>
            <td>${p.quantidade}</td>
            <td>${p.caminhao || '-'}</td>
            <td>${p.endereco || '-'}</td>
            <td style="${corStatus}">${p.status}</td>
            <td>R$ ${p.lucro.toFixed(2)}</td>
            <td>${htmlAcoes || '-'}</td>
        `;
        tabelaEntregas.appendChild(tr);
    });

    // Atualiza Painel do Dia
    document.getElementById('pedidos').innerText = totalPedidos;
    document.getElementById('vendas').innerText = `R$ ${totalVendas.toFixed(2)}`;
    document.getElementById('lucro').innerText = `R$ ${totalLucro.toFixed(2)}`;

    // Atualiza Tabela de Produção e encontra o mais vendido
    const tabelaProducao = document.getElementById('producao');
    tabelaProducao.innerHTML = '';
    let produtoMaisVendido = '';
    let maxVendas = 0;

    for (const [prod, qtd] of Object.entries(producao)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${prod}</td>
            <td>${qtd}</td>
        `;
        tabelaProducao.appendChild(tr);

        if (qtd > maxVendas) {
            maxVendas = qtd;
            produtoMaisVendido = prod;
        }
    }

    // Atualiza Previsão
    const previsaoEl = document.getElementById('previsao');
    if (totalPedidos > 0 && produtoMaisVendido !== '') {
        previsaoEl.innerText = `O produto "${produtoMaisVendido}" está com alta demanda (${maxVendas} unidades). Recomendamos focar a produção neste item!`;
    } else {
        previsaoEl.innerText = "Nenhum pedido registrado ainda. Aguardando dados para gerar previsão.";
    }

    // Carrega o Mapa enviando os filtrados
    carregarMapa(pedidosFiltrados);
}

let map;
function carregarMapa(pedidosRenderizados) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    // Se o mapa já foi inicializado, não inicializa de novo
    if (map !== undefined) {
        map.remove();
    }

    // Posição padrão do Brasil (usada se não houver coordenadas)
    map = L.map('map').setView([-14.2350, -51.9253], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let latLngs = [];

    // Usar os pedidos passados pelo parâmetro da dashboard
    const arrayParaMapa = pedidosRenderizados || pedidos;

    arrayParaMapa.forEach(p => {
        if (p.lat !== null && p.lng !== null) {
            const marker = L.marker([p.lat, p.lng]).addTo(map);
            marker.bindPopup(`<b>${p.cliente}</b><br>${p.produto} - Qtd: ${p.quantidade}`);
            latLngs.push([p.lat, p.lng]);
        }
    });

    // Adiciona a posição do Motorista no mapa do Admin
    const posicaoMoto = JSON.parse(localStorage.getItem('posicaoMotorista'));
    if (posicaoMoto && posicaoMoto.lat && posicaoMoto.lng) {
        const iconMoto = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/2555/2555013.png', // Ícone de caminhão
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
        const markerMoto = L.marker([posicaoMoto.lat, posicaoMoto.lng], { icon: iconMoto }).addTo(map);
        markerMoto.bindPopup(`<b>🚚 Motorista em Tempo Real</b><br>Última atualização: ${new Date(posicaoMoto.ultimaAtualizacao).toLocaleTimeString()}`);
        latLngs.push([posicaoMoto.lat, posicaoMoto.lng]);
    }

    // Ajusta o zoom do mapa se houver marcadores
    if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Previne problemas com os ícones de pinos do Leaflet
if (typeof L !== 'undefined') {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
}

function focarNoMapa(lat, lng) {
    if (map && lat && lng) {
        // Dá um zoom na coordenada (15 = nível do zoom)
        map.flyTo([lat, lng], 15);
        
        // Registra o log da ação no mapa
        adicionarLog(`AÇÃO NO MAPA: Focou na localização (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}).`);

        // Rola a página suavemente até o container do mapa
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        alert('Este pedido não possui coordenadas geográficas válidas.');
    }
}

// Inicializa as páginas quando carregar (Admin ou Motorista)
document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard(); // Pro admin
    carregarMotorista(); // Pro motorista
    renderizarLogs();    // Pro admin
    
    // Se logado como motorista, inicia GPS
    if (sessionStorage.getItem("motoAuth") === "true") {
        iniciarRastreamentoMotorista();
    }
});

function despacharPedido(idPedido) {
    const index = pedidos.findIndex(p => p.id === idPedido);
    if (index !== -1) {
        pedidos[index].status = 'Saiu para Entrega';
        
        // Calcula previsão de chegada (ex: 45 min após sair)
        const agora = new Date();
        agora.setMinutes(agora.getMinutes() + 45); // Estimativa padrão de 45 min para entrega
        const horaPrevisao = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        pedidos[index].previsaoChegada = horaPrevisao;

        localStorage.setItem('pedidos', JSON.stringify(pedidos));
        
        adicionarLog(`PEDIDO A CAMINHO 🚚: Pedido de ${pedidos[index].cliente} foi despachado ao motorista!`);
        alert(`Pedido do cliente ${pedidos[index].cliente} foi despachado para o motorista! O rastreio do cliente foi atualizado.`);
        
        carregarDashboard();
    }
}

// Abre o Chat do Admin
function abrirChatAdmin(idPedido) {
    const modal = document.getElementById('modal-chat-admin');
    if (!modal) return;
    
    // Mostra o modal
    modal.style.display = 'block';
    
    // Ajusta o ID no html interno pra renderizar
    document.getElementById('container-chat-admin').innerHTML = `
        <div id="chat-box-${idPedido}" class="chat-historico" style="height: 300px;"></div>
        <div class="chat-input-area">
            <input type="text" id="chat-input-${idPedido}" placeholder="Digite sua mensagem para o Cliente/Motorista...">
            <button onclick="enviarMensagemInput('${idPedido}', 'Admin')" style="color:white; padding: 5px 15px;">Enviar</button>
        </div>
    `;

    renderizarChat(idPedido, 'Admin');
    
    // Configura o botão de fechar pro admin
    const closeBtn = document.getElementById('close-chat-admin');
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        document.getElementById('container-chat-admin').innerHTML = '';
    };
}

// ========== LÓGICA DO MOTORISTA (motorista.html) ==========
function carregarMotorista() {
    const listaMotorista = document.getElementById('lista-pendentes');
    if (!listaMotorista) return;

    listaMotorista.innerHTML = '';
    
    // Filtra apenas os que saíram para entrega
    const pendentes = pedidos.filter(p => p.status === 'Saiu para Entrega');

    if (pendentes.length === 0) {
        listaMotorista.innerHTML = '<p>🎉 Nenhum pedido pendente! Bom trabalho.</p>';
    } else {
        pendentes.forEach(p => {
            const div = document.createElement('div');
            div.className = 'card pedido-card';
            
            let htmlMapaBotao = '';
            if (p.lat && p.lng) {
                htmlMapaBotao = `<button onclick="abrirRota(${p.lat}, ${p.lng})">📍 Ver no Mapa</button>`;
            } else {
                htmlMapaBotao = `<span style="color:#e74c3c;font-size:12px;">(Sem GPS)</span>`;
            }

            div.innerHTML = `
                <h3>Pedido de ${p.cliente}</h3>
                <p><strong>Caminhão/Entregador:</strong> ${p.caminhao || 'Não Informado'}</p>
                <p><strong>Produto:</strong> ${p.quantidade}x ${p.produto}</p>
                <p><strong>Endereço:</strong> ${p.endereco}</p>
                
                <div class="chat-box" style="margin-bottom: 15px;">
                    <div style="background: #e67e22; color: white; padding: 10px; border-top-left-radius: 5px; border-top-right-radius: 5px; font-weight: bold; font-size: 14px;">
                        💬 Chat com Cliente/Central
                    </div>
                    <div id="chat-box-${p.id}" class="chat-historico" style="height: 120px;"></div>
                    <div class="chat-input-area" style="padding: 5px;">
                        <input type="text" id="chat-input-${p.id}" placeholder="Mensagem..." style="font-size:12px;">
                        <button onclick="enviarMensagemInput('${p.id}', 'Motorista')" style="color:white; padding: 5px 10px; font-size:12px; background-color:#d35400;">Enviar</button>
                    </div>
                </div>

                <div class="acoes-motorista">
                    ${htmlMapaBotao}
                    <input type="text" id="codigo-${p.id}" placeholder="Cód. Confirmação (4 dig)" maxlength="4" style="width: 150px; display:inline-block; margin-bottom:0;">
                    <button onclick="confirmarEntrega('${p.id}')" style="background-color: #f39c12;">✅ Entregar</button>
                    <button onclick="excluirPedido('${p.id}')" style="background-color: #e74c3c; margin-left: 10px;">🗑️ Excluir</button>
                </div>
            `;
            listaMotorista.appendChild(div);
            
            // Renderiza o chat deste pedido em seguida
            setTimeout(() => {
                renderizarChat(p.id, 'Motorista');
            }, 100);
        });
    }
}

function abrirRota(lat, lng) {
    // Abre no maps do Google ou app padrão
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
}

function confirmarEntrega(idPedido) {
    const inputCodigo = document.getElementById(`codigo-${idPedido}`);
    const codigoDigitado = inputCodigo.value.trim();

    if (!codigoDigitado) {
        alert("Digite o código de confirmação fornecido pelo cliente.");
        return;
    }

    // Busca pedido
    const index = pedidos.findIndex(p => p.id === idPedido);
    if (index === -1) return;

    const pedido = pedidos[index];

    if (pedido.codigoSecreto === codigoDigitado) {
        // Código correto!
        pedido.status = 'Entregue';
        pedidos[index] = pedido;
        localStorage.setItem('pedidos', JSON.stringify(pedidos));

        adicionarLog(`ENTREGA CONFIRMADA ✅: Pedido de ${pedido.cliente} entregue com sucesso usando o código.`);
        alert("Entrega confirmada com sucesso! O cliente e o painel Admin foram atualizados.");
        
        // Recarrega lista
        carregarMotorista();
    } else {
        alert("❌ Código inválido! Verifique com o cliente.");
        // Log de tentativa falha
        adicionarLog(`ALERTA ⚠️: Tentativa de entrega falha para ${pedido.cliente}. Código inserido: ${codigoDigitado}.`);
    }
}

function excluirPedido(idPedido) {
    if (!confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.")) return;

    const index = pedidos.findIndex(p => p.id === idPedido);
    if (index !== -1) {
        const pedidoRemovido = pedidos[index];
        pedidos.splice(index, 1);
        localStorage.setItem('pedidos', JSON.stringify(pedidos));
        
        adicionarLog(`PEDIDO EXCLUÍDO 🗑️: O pedido de ${pedidoRemovido.cliente} foi removido pelo motorista.`);
        alert("Pedido excluído com sucesso.");
        
        carregarMotorista();
        // Se houver dashboard aberta, atualiza também
        if (typeof carregarDashboard === 'function') carregarDashboard();
    }
}

// Variável global para o mapa do cliente
let mapCliente;

// ========== LÓGICA DO CLIENTE (index.html) RASTREIO ==========
function rastrearPedidoCliente() {
    const inputRastreio = document.getElementById('codigo-rastreio').value.trim();
    const resultBox = document.getElementById('resultado-rastreio');
    
    if (!inputRastreio) {
        resultBox.innerHTML = "<p style='color:red;'>Digite um código válido.</p>";
        return;
    }

    const pedido = pedidos.find(p => p.codigoSecreto === inputRastreio);

    if (pedido) {
        let cor = 'orange';
        let mensagemStatus = '';

        if (pedido.status === 'Entregue') {
            cor = 'green';
            mensagemStatus = '<p>✅ Seu pedido já foi entregue!</p>';
        } else if (pedido.status === 'Saiu para Entrega') {
            cor = '#3498db';
            mensagemStatus = '<p>🚚 Seu pedido já saiu para entrega! O motorista está a caminho. Deixe o código em mãos para confirmar o recebimento.</p>';
        } else {
            // Preparando
            mensagemStatus = `<p>👨‍🍳 Seu pedido está sendo preparado na cozinha. <b>Prazo de preparo: ${pedido.tempoPreparo} min.</b></p>`;
        }

        if (pedido.status === 'Saiu para Entrega' && pedido.previsaoChegada) {
            mensagemStatus += `<p style="background: #e1f5fe; padding: 10px; border-left: 5px solid #03a9f4; border-radius: 4px;">🕒 <b>Previsão de Chegada:</b> Aproximadamente às <b>${pedido.previsaoChegada}</b></p>`;
        }

        let htmlMapa = '';
        if (pedido.lat && pedido.lng) {
            htmlMapa = '<div id="map-cliente" style="height: 300px; width: 100%; margin-top: 15px; border-radius: 10px; z-index: 1;"></div>';
        }

        // Adiciona a Interface de Chat para o Cliente
        let htmlChat = `
            <div class="chat-box">
                <div style="background: #34495e; color: white; padding: 10px; border-top-left-radius: 5px; border-top-right-radius: 5px; font-weight: bold; font-size: 14px;">
                    💬 Chat do Pedido
                </div>
                <div id="chat-box-${pedido.id}" class="chat-historico"></div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input-${pedido.id}" placeholder="Digite sua mensagem...">
                    <button onclick="enviarMensagemInput('${pedido.id}', 'Cliente')" style="color:white; padding: 5px 15px;">Enviar</button>
                </div>
            </div>
        `;

        resultBox.innerHTML = `
            <div style="border: 1px solid #ddd; padding: 10px; margin-top: 10px; border-radius: 5px;">
                <p><strong>Cliente:</strong> ${pedido.cliente}</p>
                <p><strong>Caminhão/Motorista:</strong> ${pedido.caminhao || 'Não Informado'}</p>
                <p><strong>Produto:</strong> ${pedido.produto}</p>
                <p><strong>Endereço:</strong> ${pedido.endereco}</p>
                <p><strong>Status:</strong> <span style="color: ${cor}; font-weight:bold; font-size:18px;">${pedido.status}</span></p>
                ${mensagemStatus}
                ${htmlChat}
                ${htmlMapa}
            </div>
        `;

        // Renderiza as mensagens logo após inserir no DOM
        setTimeout(() => {
            renderizarChat(pedido.id, 'Cliente');
        }, 100);

        // Renderiza o mapa do cliente se tiver coordenadas
        if (pedido.lat && pedido.lng) {
            // Pequeno delay para garantir que o HTML foi renderizado antes de chamar o L.map
            setTimeout(() => {
                if (mapCliente !== undefined) {
                    mapCliente.remove();
                }

                mapCliente = L.map('map-cliente').setView([pedido.lat, pedido.lng], 14);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(mapCliente);

                // Destino (Casa do Cliente)
                const destinoMarker = L.marker([pedido.lat, pedido.lng]).addTo(mapCliente)
                    .bindPopup(`<b>Sua Casa</b><br>${pedido.endereco}`);

                // Simulação da posição do pedido
                let posAtualPin = [];
                let textoPin = '';

                // Vamos simular que a padaria fica a uns ~5km de diferença na latitude/longitude
                const latLoja = pedido.lat - 0.006;
                const lngLoja = pedido.lng - 0.006;

                if (pedido.status === 'Preparando') {
                    posAtualPin = [latLoja, lngLoja];
                    textoPin = '<b>🏬 Loja</b><br>Preparando seu pedido...';
                } else if (pedido.status === 'Saiu para Entrega') {
                    // Usa a posição real do motorista se disponível
                    const posicaoMotoReal = JSON.parse(localStorage.getItem('posicaoMotorista'));
                    if (posicaoMotoReal && posicaoMotoReal.lat && posicaoMotoReal.lng) {
                        posAtualPin = [posicaoMotoReal.lat, posicaoMotoReal.lng];
                        textoPin = '<b>🚚 Motorista</b><br>A caminho da sua casa! (GPS Real)';
                    } else {
                        // Backup simulação se GPS não estiver disponível
                        posAtualPin = [pedido.lat - 0.002, pedido.lng - 0.002];
                        textoPin = '<b>🚚 Motorista</b><br>A caminho da sua casa!';
                    }
                } else if (pedido.status === 'Entregue') {
                    posAtualPin = [pedido.lat, pedido.lng];
                    textoPin = '<b>✅ Pedido Entregue</b><br>Aproveite!';
                }

                // Cria o pin atual
                const atualMarker = L.marker(posAtualPin).addTo(mapCliente)
                    .bindPopup(textoPin)
                    .openPopup();

                // Traça uma linha (rota simulada reta) se não estiver entregue pra mostrar o caminho
                if (pedido.status !== 'Entregue') {
                    const latlngs = [
                        [latLoja, lngLoja], // Loja
                        [pedido.lat, pedido.lng] // Casa
                    ];
                    L.polyline(latlngs, {color: '#3498db', dashArray: '5, 10'}).addTo(mapCliente);
                }

                // Ajusta o zoom para ver ambos os pontos (loja, motorista e destino)
                const group = new L.featureGroup([destinoMarker, atualMarker, L.marker([latLoja, lngLoja])]);
                mapCliente.fitBounds(group.getBounds(), {padding: [40, 40]});

            }, 100);
        }

    } else {
        resultBox.innerHTML = "<p style='color:red;'>Código não encontrado.</p>";
    }
}

// ========== LÓGICA DO CLIENTE (HISTÓRICO) ==========
function verHistoricoCliente() {
    const nomeInput = document.getElementById('nome-historico').value.trim().toLowerCase();
    const resultBox = document.getElementById('resultado-historico');

    if (!nomeInput) {
        resultBox.innerHTML = "<p style='color:red;'>Por favor, digite seu nome para buscar.</p>";
        return;
    }

    // Busca todos os pedidos onde o nome do cliente inclui o texto digitado
    const historico = pedidos.filter(p => p.cliente && p.cliente.toLowerCase().includes(nomeInput));

    if (historico.length > 0) {
        // Ordena os pedidos para os mais recentes (pelo ID) ficarem no topo da lista
        historico.sort((a, b) => b.id - a.id);

        let html = '';
        
        let totalGasto = 0;
        let totalPedidos = historico.length;
        
        historico.forEach(pedido => {
            let corStatus = 'orange';
            if (pedido.status === 'Entregue') corStatus = 'green';
            else if (pedido.status === 'Saiu para Entrega') corStatus = '#3498db';

            // Formata a data (se foi gravada no novo formato a partir de hoje)
            let dataFormatada = 'Data Desconhecida';
            if (pedido.data) {
                dataFormatada = pedido.data.split('-').reverse().join('/');
            }

            const valorExibir = pedido.valor || 0;
            totalGasto += valorExibir;

            html += `
                <div style="border: 1px solid #ddd; padding: 10px; margin-top: 10px; border-radius: 5px; background: #fafafa; position: relative;">
                    <span style="position: absolute; top: 10px; right: 10px; font-size: 12px; color: #7f8c8d;">Cód: ${pedido.codigoSecreto || 'N/A'}</span>
                    <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 14px;">📅 ${dataFormatada}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Produto:</strong> ${pedido.quantidade}x ${pedido.produto}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Valor:</strong> R$ ${valorExibir.toFixed(2)}</p>
                    <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${corStatus}; font-weight:bold;">${pedido.status}</span></p>
                </div>
            `;
        });
        
        // Adiciona um sumario no topo
        resultBox.innerHTML = `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center; border: 1px solid #e9ecef; margin-bottom: 15px;">
                <p style="margin: 0;"><strong>Você já fez ${totalPedidos} pedido(s) conosco!</strong></p>
                <p style="margin: 5px 0 0 0; color: #27ae60;"><strong>Total Gasto: R$ ${totalGasto.toFixed(2)}</strong></p>
            </div>
            ${html}
        `;
    } else {
        resultBox.innerHTML = "<p style='color:#7f8c8d;'>Nenhuma compra encontrada para este nome. Verifique se digitou exatamente como fez o pedido.</p>";
    }
}

// ========== SISTEMA DE CHAT ==========
function adicionarMensagem(idPedido, remetente, mensagem) {
    // Encontra o pedido
    const index = pedidos.findIndex(p => p.id === idPedido);
    if (index === -1) return;

    // Se o pedido não tiver o array de mensagens, cria
    if (!pedidos[index].mensagens) {
        pedidos[index].mensagens = [];
    }

    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    pedidos[index].mensagens.push({
        remetente: remetente, // 'Cliente', 'Admin' ou 'Motorista'
        texto: mensagem,
        hora: hora
    });

    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    
    // Atualiza a interface do chat que estiver aberta
    renderizarChat(idPedido, remetente); // passa o remetente atual pra saber como renderizar os balões
}

function renderizarChat(idPedido, visualizador) {
    const pedido = pedidos.find(p => p.id === idPedido);
    if (!pedido) return;

    const chatContainer = document.getElementById(`chat-box-${idPedido}`);
    if (!chatContainer) return; // a janela de chat não está aberta na tela atual

    let html = '';
    const mensagens = pedido.mensagens || [];

    if (mensagens.length === 0) {
        html = '<p style="text-align:center; color:#999; font-size:12px; margin-top:50px;">Nenhuma mensagem ainda. Inicie a conversa!</p>';
    } else {
        mensagens.forEach(msg => {
            // Define de que lado ou de que cor fica o balão
            let classeBalao = 'mensagem ';
            let nomeExibicao = msg.remetente;

            if (msg.remetente === visualizador) {
                // Mensagem minha (fica na direita, cor especifica)
                if (visualizador === 'Cliente') classeBalao += 'msg-cliente';
                else if (visualizador === 'Admin') classeBalao += 'msg-admin';
                else classeBalao += 'msg-motorista'; 
                
                classeBalao += '" style="align-self: flex-end; text-align: right; background: #e8f8f5;';
                nomeExibicao = 'Você';
            } else {
                // Mensagem do outro (fica na esquerda, cor neutra)
                classeBalao += '" style="align-self: flex-start; text-align: left; background: #eaeded;';
            }

            html += `
                <div class="${classeBalao}">
                    <strong>${nomeExibicao}</strong>
                    <div style="margin-top:3px;">${msg.texto}</div>
                    <span class="msg-info">${msg.hora}</span>
                </div>
            `;
        });
    }

    chatContainer.innerHTML = html;
    
    // Rola para a última mensagem
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function enviarMensagemInput(idPedido, remetente) {
    const inputEl = document.getElementById(`chat-input-${idPedido}`);
    if (!inputEl) return;

    const texto = inputEl.value.trim();
    if (!texto) return;

    adicionarMensagem(idPedido, remetente, texto);
    
    // Limpa o input
    inputEl.value = '';
}
