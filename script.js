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
function irAdmin() {
    sessionStorage.setItem("adminAuth", "true");
    window.location.href = "admin.html";
}

function irMotorista() {
    sessionStorage.setItem("motoAuth", "true");
    window.location.href = "motorista.html";
}

function sairSistema() {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("motoAuth");
    window.location.href = "index.html";
}

// ========== LÓGICA DO INDEX.HTML ==========
function selecionarProduto(nomeProduto) {
    const inputProduto = document.getElementById('produto');
    if (inputProduto) {
        inputProduto.value = nomeProduto;
    }
}

async function registrarPedido() {
    const cliente = document.getElementById('cliente').value;
    const produto = document.getElementById('produto').value;
    const quantidade = parseInt(document.getElementById('quantidade').value);
    const rota = document.getElementById('rota').value;
    const custo = parseFloat(document.getElementById('custo').value);
    const valor = parseFloat(document.getElementById('valor').value);
    const endereco = document.getElementById('endereco').value;

    // Validação básica
    if (!cliente || !produto || isNaN(quantidade) || !rota || isNaN(custo) || isNaN(valor) || !endereco) {
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
        rota,
        endereco,
        custo,
        valor,
        lucro,
        lat,
        lng,
        codigoSecreto,
        status: "Preparando" // Preparando, Saiu para Entrega, ou Entregue
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
    document.getElementById('rota').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('custo').value = '';
    document.getElementById('valor').value = '';
}

// Já existe um script inline para irAdmin() no index.html, mas mantemos como backup
function irAdmin() {
    window.location.href = "admin.html";
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
        
        if (p.status === 'Preparando') {
            htmlAcoes += `<button onclick="despacharPedido('${p.id}')" style="background-color: #f39c12; font-size: 12px;">🚚 Despachar</button>`;
        }

        tr.innerHTML = `
            <td>${p.cliente}</td>
            <td>${p.produto}</td>
            <td>${p.quantidade}</td>
            <td>${p.rota}</td>
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
});

function despacharPedido(idPedido) {
    const index = pedidos.findIndex(p => p.id === idPedido);
    if (index !== -1) {
        pedidos[index].status = 'Saiu para Entrega';
        localStorage.setItem('pedidos', JSON.stringify(pedidos));
        
        adicionarLog(`PEDIDO A CAMINHO 🚚: Pedido de ${pedidos[index].cliente} foi despachado ao motorista!`);
        alert(`Pedido do cliente ${pedidos[index].cliente} foi despachado para o motorista! O rastreio do cliente foi atualizado.`);
        
        carregarDashboard();
    }
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
                <p><strong>Produto:</strong> ${p.quantidade}x ${p.produto}</p>
                <p><strong>Endereço:</strong> ${p.endereco}</p>
                <div class="acoes-motorista">
                    ${htmlMapaBotao}
                    <input type="text" id="codigo-${p.id}" placeholder="Cód. Confirmação (4 dig)" maxlength="4" style="width: 150px; display:inline-block; margin-bottom:0;">
                    <button onclick="confirmarEntrega('${p.id}')" style="background-color: #f39c12;">✅ Entregar</button>
                </div>
            `;
            listaMotorista.appendChild(div);
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
            mensagemStatus = '<p>👨‍🍳 Seu pedido está sendo preparado na cozinha e em breve será entregue ao motorista.</p>';
        }

        let htmlMapa = '';
        if (pedido.lat && pedido.lng) {
            htmlMapa = '<div id="map-cliente" style="height: 300px; width: 100%; margin-top: 15px; border-radius: 10px; z-index: 1;"></div>';
        }

        resultBox.innerHTML = `
            <div style="border: 1px solid #ddd; padding: 10px; margin-top: 10px; border-radius: 5px;">
                <p><strong>Cliente:</strong> ${pedido.cliente}</p>
                <p><strong>Produto:</strong> ${pedido.produto}</p>
                <p><strong>Endereço:</strong> ${pedido.endereco}</p>
                <p><strong>Status:</strong> <span style="color: ${cor}; font-weight:bold; font-size:18px;">${pedido.status}</span></p>
                ${mensagemStatus}
                ${htmlMapa}
            </div>
        `;

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
                    // Simula que o motorista está no meio do caminho (na metade)
                    posAtualPin = [pedido.lat - 0.002, pedido.lng - 0.002];
                    textoPin = '<b>🚚 Motorista</b><br>A caminho da sua casa!';
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
