class FinanceApp {
    constructor() {
        console.log('🔄 SISTEMA INICIADO - Versão 4.0 - ' + new Date().toISOString());
        
        this.gastos = this.carregarDados('gastos') || [];
        this.ganhos = this.carregarDados('ganhos') || [];
        this.pessoas = this.carregarDados('pessoas') || [];
        this.recorrentes = this.carregarDados('recorrentes') || [];
        this.cartoes = this.carregarDados('cartoes') || [];
        this.comprasCartao = this.carregarDados('comprasCartao') || [];
        
        this.filtrosAtivos = {
            status: 'todos',
            pessoa: 'todos',
            data: ''
        };
        this.chartGastosGanhos = null;
        this.chartCategorias = null;
        this.chartEvolucao = null;
        
        this.inicializarApp();
    }

    inicializarApp() {
        console.log('✅ Inicializando sistema...');
        this.configurarEventos();
        this.atualizarDashboard();
        this.atualizarListaTransacoes();
        this.atualizarListaPessoas();
        this.atualizarListaRecorrentes();
        this.atualizarListaCartoes();
        this.atualizarListaComprasCartao();
        this.carregarSelectPessoas();
        this.carregarSelectCartoes();
        this.configurarDataAtual();
        this.carregarFiltros();
        console.log('✅ Sistema inicializado com sucesso!');
    }

    configurarEventos() {
        console.log('🔧 Configurando eventos...');
        
        // Navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.mudarAba(e.currentTarget.dataset.tab);
            });
        });

        // Formulários
        const formGasto = document.getElementById('formGasto');
        const formGanho = document.getElementById('formGanho');
        const formPessoa = document.getElementById('formPessoa');
        const formRecorrente = document.getElementById('formRecorrente');
        const formCartao = document.getElementById('formCartao');
        const formCompraCartao = document.getElementById('formCompraCartao');

        if (formGasto) formGasto.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarGasto();
        });

        if (formGanho) formGanho.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarGanho();
        });

        if (formPessoa) formPessoa.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarPessoa();
        });

        if (formRecorrente) formRecorrente.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarRecorrente();
        });

        if (formCartao) formCartao.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarCartao();
        });

        if (formCompraCartao) formCompraCartao.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarCompraCartao();
        });

        // Mostrar/ocultar campo de parcelas
        const tipoRecorrente = document.getElementById('tipoRecorrente');
        if (tipoRecorrente) {
            tipoRecorrente.addEventListener('change', (e) => {
                const parcelasGroup = document.getElementById('parcelas-group');
                if (parcelasGroup) {
                    parcelasGroup.style.display = e.target.value === 'parcelado' ? 'block' : 'none';
                }
            });
        }

        // Filtros
        const filtroStatus = document.getElementById('filtroStatus');
        const filtroPessoa = document.getElementById('filtroPessoa');
        const filtroData = document.getElementById('filtroData');

        if (filtroStatus) filtroStatus.addEventListener('change', () => this.aplicarFiltros());
        if (filtroPessoa) filtroPessoa.addEventListener('change', () => this.aplicarFiltros());
        if (filtroData) filtroData.addEventListener('change', () => this.aplicarFiltros());

        console.log('✅ Eventos configurados!');
    }

    configurarDataAtual() {
        const hoje = new Date().toISOString().split('T')[0];
        const dataGasto = document.getElementById('dataGasto');
        const dataGanho = document.getElementById('dataGanho');
        const dataInicioRecorrente = document.getElementById('dataInicioRecorrente');
        const dataCompraCartao = document.getElementById('dataCompraCartao');
        
        if (dataGasto) dataGasto.value = hoje;
        if (dataGanho) dataGanho.value = hoje;
        if (dataInicioRecorrente) dataInicioRecorrente.value = hoje;
        if (dataCompraCartao) dataCompraCartao.value = hoje;
    }

    carregarFiltros() {
        const filtroPessoa = document.getElementById('filtroPessoa');
        if (filtroPessoa) {
            filtroPessoa.innerHTML = '<option value="todos">Todas as pessoas</option>' +
                this.pessoas.map(p => `<option value="${p}">${p}</option>`).join('');
        }
    }

    mudarAba(abaId) {
        console.log('📱 Mudando para aba:', abaId);
        
        const navBtns = document.querySelectorAll('.nav-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        const targetNavBtn = document.querySelector(`[data-tab="${abaId}"]`);
        const targetTab = document.getElementById(abaId);
        
        if (!targetNavBtn || !targetTab) {
            console.warn(`❌ Aba ${abaId} não encontrada`);
            return;
        }
        
        navBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        targetNavBtn.classList.add('active');
        targetTab.classList.add('active');

        if (abaId === 'reports') {
            setTimeout(() => {
                if (document.getElementById('graficoGastosGanhos') || 
                    document.getElementById('graficoCategorias') || 
                    document.getElementById('graficoEvolucao')) {
                    this.gerarGraficos();
                }
            }, 300);
        } else if (abaId === 'recurring') {
            this.atualizarListaRecorrentes();
        } else if (abaId === 'cards') {
            this.atualizarListaCartoes();
            this.atualizarListaComprasCartao();
        } else if (abaId === 'transactions') {
            this.aplicarFiltros();
        }
    }

    // ========== CRUD GASTOS ==========
    salvarGasto() {
        const id = document.getElementById('gastoId');
        const descricao = document.getElementById('descricaoGasto');
        const valor = document.getElementById('valorGasto');
        const categoria = document.getElementById('categoriaGasto');
        const responsavel = document.getElementById('responsavelGasto');
        const data = document.getElementById('dataGasto');

        if (!descricao || !valor || !categoria || !responsavel || !data) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        if (!descricao.value || !valor.value || !categoria.value) {
            this.mostrarToast('Preencha todos os campos!', 'error');
            return;
        }

        const gastoValor = parseFloat(valor.value);

        const gasto = {
            id: id.value ? parseInt(id.value) : Date.now(),
            descricao: descricao.value,
            valor: gastoValor,
            categoria: categoria.value,
            responsavel: responsavel.value,
            data: data.value,
            pago: false,
            dataPagamento: null,
            tipo: 'gasto',
            timestamp: new Date().toISOString()
        };

        if (id.value) {
            const index = this.gastos.findIndex(g => g.id === parseInt(id.value));
            if (index !== -1) {
                this.gastos[index] = { ...this.gastos[index], ...gasto };
                this.mostrarToast('Gasto atualizado!', 'success');
            }
        } else {
            this.gastos.push(gasto);
            this.mostrarToast('Gasto adicionado!', 'success');
        }

        this.salvarDados('gastos', this.gastos);
        this.fecharModal('gasto');
        this.refreshCompleto();
    }

    editarGasto(gastoId) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (gasto) {
            const idElement = document.getElementById('gastoId');
            const descricaoElement = document.getElementById('descricaoGasto');
            const valorElement = document.getElementById('valorGasto');
            const categoriaElement = document.getElementById('categoriaGasto');
            const responsavelElement = document.getElementById('responsavelGasto');
            const dataElement = document.getElementById('dataGasto');

            if (idElement) idElement.value = gasto.id;
            if (descricaoElement) descricaoElement.value = gasto.descricao;
            if (valorElement) valorElement.value = gasto.valor;
            if (categoriaElement) categoriaElement.value = gasto.categoria;
            if (responsavelElement) responsavelElement.value = gasto.responsavel;
            if (dataElement) dataElement.value = gasto.data;
            
            mostrarModal('gasto');
        }
    }

    excluirGasto(gastoId) {
        this.mostrarConfirmacao('Excluir este gasto?', () => {
            this.gastos = this.gastos.filter(g => g.id !== gastoId);
            this.salvarDados('gastos', this.gastos);
            this.refreshCompleto();
            this.mostrarToast('Gasto excluído!', 'success');
        });
    }

    // ========== CRUD GANHOS ==========
    salvarGanho() {
        const id = document.getElementById('ganhoId');
        const descricao = document.getElementById('descricaoGanho');
        const valor = document.getElementById('valorGanho');
        const data = document.getElementById('dataGanho');

        if (!descricao || !valor || !data) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        if (!descricao.value || !valor.value) {
            this.mostrarToast('Preencha todos os campos!', 'error');
            return;
        }

        const ganhoValor = parseFloat(valor.value);

        const ganho = {
            id: id.value ? parseInt(id.value) : Date.now(),
            descricao: descricao.value,
            valor: ganhoValor,
            data: data.value,
            tipo: 'ganho',
            timestamp: new Date().toISOString()
        };

        if (id.value) {
            const index = this.ganhos.findIndex(g => g.id === parseInt(id.value));
            if (index !== -1) {
                this.ganhos[index] = { ...this.ganhos[index], ...ganho };
                this.mostrarToast('Ganho atualizado!', 'success');
            }
        } else {
            this.ganhos.push(ganho);
            this.mostrarToast('Ganho adicionado!', 'success');
        }

        this.salvarDados('ganhos', this.ganhos);
        this.fecharModal('ganho');
        this.refreshCompleto();
    }

    editarGanho(ganhoId) {
        const ganho = this.ganhos.find(g => g.id === ganhoId);
        if (ganho) {
            const idElement = document.getElementById('ganhoId');
            const descricaoElement = document.getElementById('descricaoGanho');
            const valorElement = document.getElementById('valorGanho');
            const dataElement = document.getElementById('dataGanho');

            if (idElement) idElement.value = ganho.id;
            if (descricaoElement) descricaoElement.value = ganho.descricao;
            if (valorElement) valorElement.value = ganho.valor;
            if (dataElement) dataElement.value = ganho.data;
            
            mostrarModal('ganho');
        }
    }

    excluirGanho(ganhoId) {
        this.mostrarConfirmacao('Excluir este ganho?', () => {
            this.ganhos = this.ganhos.filter(g => g.id !== ganhoId);
            this.salvarDados('ganhos', this.ganhos);
            this.refreshCompleto();
            this.mostrarToast('Ganho excluído!', 'success');
        });
    }

    // ========== CRUD PESSOAS ==========
    salvarPessoa() {
        const id = document.getElementById('pessoaId');
        const nome = document.getElementById('nomePessoa');

        if (!id || !nome) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        const nomeValue = nome.value.trim();

        if (!nomeValue) {
            this.mostrarToast('Digite um nome!', 'error');
            return;
        }

        if (id.value) {
            const index = parseInt(id.value);
            this.pessoas[index] = nomeValue;
            this.mostrarToast('Pessoa atualizada!', 'success');
        } else {
            if (this.pessoas.includes(nomeValue)) {
                this.mostrarToast('Pessoa já existe!', 'warning');
                return;
            }
            this.pessoas.push(nomeValue);
            this.mostrarToast('Pessoa adicionada!', 'success');
        }

        this.salvarDados('pessoas', this.pessoas);
        this.carregarSelectPessoas();
        this.fecharModal('pessoa');
        this.refreshCompleto();
    }

    editarPessoa(index) {
        const idElement = document.getElementById('pessoaId');
        const nomeElement = document.getElementById('nomePessoa');

        if (idElement && nomeElement) {
            idElement.value = index;
            nomeElement.value = this.pessoas[index];
            mostrarModal('pessoa');
        }
    }

    excluirPessoa(index) {
        const nome = this.pessoas[index];
        const gastosRelacionados = this.gastos.filter(g => g.responsavel === nome);
        
        if (gastosRelacionados.length > 0) {
            this.mostrarConfirmacao(
                `Esta pessoa tem ${gastosRelacionados.length} gasto(s). Excluir mesmo assim?`,
                () => this.excluirPessoaEFluxo(index)
            );
        } else {
            this.excluirPessoaEFluxo(index);
        }
    }

    excluirPessoaEFluxo(index) {
        const nome = this.pessoas[index];
        this.pessoas.splice(index, 1);
        
        this.gastos.forEach(gasto => {
            if (gasto.responsavel === nome) {
                gasto.responsavel = 'Eu';
            }
        });

        this.salvarDados('pessoas', this.pessoas);
        this.salvarDados('gastos', this.gastos);
        this.carregarSelectPessoas();
        this.refreshCompleto();
        this.mostrarToast('Pessoa excluída!', 'success');
    }

    // ========== CRUD RECORRENTES ==========
    salvarRecorrente() {
        const id = document.getElementById('recorrenteId');
        const descricao = document.getElementById('descricaoRecorrente');
        const valor = document.getElementById('valorRecorrente');
        const categoria = document.getElementById('categoriaRecorrente');
        const tipo = document.getElementById('tipoRecorrente');
        const parcelas = document.getElementById('parcelasRecorrente');
        const responsavel = document.getElementById('responsavelRecorrente');
        const dataInicio = document.getElementById('dataInicioRecorrente');

        if (!descricao || !valor || !categoria || !tipo || !responsavel || !dataInicio) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        if (!descricao.value || !valor.value || !categoria.value) {
            this.mostrarToast('Preencha todos os campos!', 'error');
            return;
        }

        const recorrenteValor = parseFloat(valor.value);
        const parcelasValue = tipo.value === 'parcelado' && parcelas ? parseInt(parcelas.value) : null;

        const recorrente = {
            id: id.value ? parseInt(id.value) : Date.now(),
            descricao: descricao.value,
            valor: recorrenteValor,
            categoria: categoria.value,
            tipo: tipo.value,
            parcelas: parcelasValue,
            parcelasPagas: id.value ? this.recorrentes.find(r => r.id === parseInt(id.value))?.parcelasPagas || 0 : 0,
            responsavel: responsavel.value,
            dataInicio: dataInicio.value,
            ativo: true,
            timestamp: new Date().toISOString()
        };

        if (id.value) {
            const index = this.recorrentes.findIndex(r => r.id === parseInt(id.value));
            if (index !== -1) {
                this.recorrentes[index] = { ...this.recorrentes[index], ...recorrente };
                this.mostrarToast('Recorrente atualizado!', 'success');
            }
        } else {
            this.recorrentes.push(recorrente);
            this.mostrarToast('Recorrente adicionado!', 'success');
            
            // REGRA 1: Se for do "EU", gera transação no mês atual
            if (responsavel.value === 'Eu') {
                this.gerarTransacaoRecorrente(recorrente);
            }
            
            // REGRA 2: Se for de outra pessoa, atualiza o controle
            if (responsavel.value !== 'Eu') {
                this.atualizarDividaPessoa(recorrente);
            }
        }

        this.salvarDados('recorrentes', this.recorrentes);
        this.fecharModal('recorrente');
        this.refreshCompleto();
    }

    // REGRA 1: Gerar transação para recorrente do "EU"
    gerarTransacaoRecorrente(recorrente) {
        const hoje = new Date();
        const dataInicio = new Date(recorrente.dataInicio);
        
        // Só gera transação se for do mês atual ou futuro
        if (dataInicio.getMonth() === hoje.getMonth() && dataInicio.getFullYear() === hoje.getFullYear()) {
            const gastoExistente = this.gastos.find(gasto => 
                gasto.descricao === recorrente.descricao && 
                gasto.data === recorrente.dataInicio &&
                gasto.recorrenteId === recorrente.id
            );
            
            if (!gastoExistente) {
                const novoGasto = {
                    id: Date.now() + Math.random(),
                    descricao: recorrente.descricao,
                    valor: recorrente.valor,
                    categoria: recorrente.categoria,
                    responsavel: recorrente.responsavel,
                    data: recorrente.dataInicio,
                    pago: false,
                    dataPagamento: null,
                    tipo: 'gasto',
                    recorrenteId: recorrente.id,
                    timestamp: new Date().toISOString()
                };
                
                this.gastos.push(novoGasto);
                this.salvarDados('gastos', this.gastos);
                this.mostrarToast(`Gasto recorrente "${recorrente.descricao}" gerado!`, 'info');
            }
        }
    }

    // REGRA 2: Atualizar dívida da pessoa quando cadastrar recorrente parcelado
    atualizarDividaPessoa(recorrente) {
        const pessoa = recorrente.responsavel;
        const pessoaIndex = this.pessoas.findIndex(p => p === pessoa);
        
        if (pessoaIndex === -1) {
            this.pessoas.push(pessoa);
            this.salvarDados('pessoas', this.pessoas);
            this.carregarSelectPessoas();
        }
        
        // Se for parcelado, já gera os gastos futuros
        if (recorrente.tipo === 'parcelado' && recorrente.parcelas) {
            this.gerarGastosParceladosPessoa(recorrente);
        }
        
        this.mostrarToast(`Dívida de ${pessoa} atualizada!`, 'info');
    }

    gerarGastosParceladosPessoa(recorrente) {
        for (let i = 1; i <= recorrente.parcelas; i++) {
            const dataParcela = this.calcularDataParcela(recorrente.dataInicio, i);
            
            const gastoExistente = this.gastos.find(gasto => 
                gasto.descricao === `${recorrente.descricao} (Parcela ${i}/${recorrente.parcelas})` &&
                gasto.data === dataParcela &&
                gasto.recorrenteId === recorrente.id
            );
            
            if (!gastoExistente) {
                const gastoParcela = {
                    id: Date.now() + Math.random() + i,
                    descricao: `${recorrente.descricao} (Parcela ${i}/${recorrente.parcelas})`,
                    valor: recorrente.valor,
                    categoria: recorrente.categoria,
                    responsavel: recorrente.responsavel,
                    data: dataParcela,
                    pago: false,
                    dataPagamento: null,
                    tipo: 'gasto',
                    recorrenteId: recorrente.id,
                    parcelaNumero: i,
                    totalParcelas: recorrente.parcelas,
                    timestamp: new Date().toISOString()
                };
                
                this.gastos.push(gastoParcela);
            }
        }
        
        this.salvarDados('gastos', this.gastos);
    }

    editarRecorrente(recorrenteId) {
        const recorrente = this.recorrentes.find(r => r.id === recorrenteId);
        if (recorrente) {
            const idElement = document.getElementById('recorrenteId');
            const descricaoElement = document.getElementById('descricaoRecorrente');
            const valorElement = document.getElementById('valorRecorrente');
            const categoriaElement = document.getElementById('categoriaRecorrente');
            const tipoElement = document.getElementById('tipoRecorrente');
            const parcelasElement = document.getElementById('parcelasRecorrente');
            const responsavelElement = document.getElementById('responsavelRecorrente');
            const dataInicioElement = document.getElementById('dataInicioRecorrente');
            const parcelasGroup = document.getElementById('parcelas-group');

            if (idElement) idElement.value = recorrente.id;
            if (descricaoElement) descricaoElement.value = recorrente.descricao;
            if (valorElement) valorElement.value = recorrente.valor;
            if (categoriaElement) categoriaElement.value = recorrente.categoria;
            if (tipoElement) tipoElement.value = recorrente.tipo;
            if (parcelasElement) parcelasElement.value = recorrente.parcelas || '';
            if (responsavelElement) responsavelElement.value = recorrente.responsavel;
            if (dataInicioElement) dataInicioElement.value = recorrente.dataInicio;

            if (parcelasGroup) {
                parcelasGroup.style.display = recorrente.tipo === 'parcelado' ? 'block' : 'none';
            }

            mostrarModal('recorrente');
        }
    }

    excluirRecorrente(recorrenteId) {
        this.mostrarConfirmacao('Excluir este recorrente?', () => {
            this.recorrentes = this.recorrentes.filter(r => r.id !== recorrenteId);
            this.salvarDados('recorrentes', this.recorrentes);
            this.refreshCompleto();
            this.mostrarToast('Recorrente excluído!', 'success');
        });
    }

    // ========== TOGGLE STATUS RECORRENTE ==========
    toggleRecorrenteAtivo(recorrenteId) {
        const recorrente = this.recorrentes.find(r => r.id === recorrenteId);
        if (recorrente) {
            recorrente.ativo = !recorrente.ativo;
            this.salvarDados('recorrentes', this.recorrentes);
            this.refreshCompleto();
            this.mostrarToast(`Recorrente ${recorrente.ativo ? 'ativado' : 'desativado'}!`, 'success');
        }
    }

    // ========== PAGAMENTO PARCIAL/TOTAL DE PESSOAS ==========
    marcarParcelaPaga(recorrenteId) {
        const recorrente = this.recorrentes.find(r => r.id === recorrenteId);
        if (recorrente && recorrente.parcelas) {
            if (recorrente.parcelasPagas < recorrente.parcelas) {
                recorrente.parcelasPagas++;
                
                const dataParcela = this.calcularDataParcela(recorrente.dataInicio, recorrente.parcelasPagas);
                
                // REGRA 4: Se for de outra pessoa, cria ganho apenas quando marcar como pago
                if (recorrente.responsavel !== 'Eu') {
                    const ganhoParcela = {
                        id: Date.now(),
                        descricao: `Pagamento de ${recorrente.responsavel} - ${recorrente.descricao} (Parcela ${recorrente.parcelasPagas}/${recorrente.parcelas})`,
                        valor: recorrente.valor,
                        data: dataParcela,
                        tipo: 'ganho',
                        origem: 'pagamento_pessoa',
                        pessoaOrigem: recorrente.responsavel,
                        timestamp: new Date().toISOString()
                    };
                    this.ganhos.push(ganhoParcela);
                    this.mostrarToast(`Recebido de ${recorrente.responsavel}!`, 'success');
                } else {
                    const gastoParcela = {
                        id: Date.now(),
                        descricao: `${recorrente.descricao} (Parcela ${recorrente.parcelasPagas}/${recorrente.parcelas})`,
                        valor: recorrente.valor,
                        categoria: recorrente.categoria,
                        responsavel: recorrente.responsavel,
                        data: dataParcela,
                        pago: true,
                        dataPagamento: new Date().toISOString().split('T')[0],
                        tipo: 'gasto',
                        recorrenteId: recorrente.id,
                        timestamp: new Date().toISOString()
                    };
                    this.gastos.push(gastoParcela);
                    this.mostrarToast('Parcela paga!', 'success');
                }

                if (recorrente.parcelasPagas === recorrente.parcelas) {
                    recorrente.ativo = false;
                }

                this.salvarDados('recorrentes', this.recorrentes);
                this.salvarDados('gastos', this.gastos);
                this.salvarDados('ganhos', this.ganhos);
                this.refreshCompleto();
            }
        }
    }

    // ========== PAGAMENTO PARCIAL DE GASTOS DE PESSOAS ==========
    receberPagamentoParcial(gastoId, valorPago) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (gasto && gasto.responsavel !== 'Eu') {
            const valorRestante = gasto.valor - valorPago;
            
            // REGRA 4: Cria ganho apenas quando marcar pagamento
            const ganhoPagamento = {
                id: Date.now(),
                descricao: `Pagamento de ${gasto.responsavel} - ${gasto.descricao}`,
                valor: valorPago,
                data: new Date().toISOString().split('T')[0],
                tipo: 'ganho',
                origem: 'pagamento_pessoa',
                pessoaOrigem: gasto.responsavel,
                timestamp: new Date().toISOString()
            };
            this.ganhos.push(ganhoPagamento);
            
            if (valorRestante <= 0) {
                gasto.pago = true;
                gasto.dataPagamento = new Date().toISOString().split('T')[0];
                this.mostrarToast(`Pagamento total recebido de ${gasto.responsavel}!`, 'success');
            } else {
                gasto.valor = valorRestante;
                this.mostrarToast(`Pagamento parcial de R$ ${valorPago.toFixed(2)} recebido!`, 'info');
            }
            
            this.salvarDados('gastos', this.gastos);
            this.salvarDados('ganhos', this.ganhos);
            this.refreshCompleto();
        }
    }

    // ========== MODAL PARA PAGAMENTO PARCIAL ==========
    mostrarModalPagamentoParcial(gastoId) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (!gasto || gasto.responsavel === 'Eu') return;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); display: flex; align-items: center; 
            justify-content: center; z-index: 1000; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 15px; max-width: 400px; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #333;">Receber Pagamento</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: none; border: none; font-size: 1.5em; cursor: pointer; color: #666;">
                        ✕
                    </button>
                </div>
                <div style="margin-bottom: 20px;">
                    <p><strong>De:</strong> ${gasto.responsavel}</p>
                    <p><strong>Descrição:</strong> ${gasto.descricao}</p>
                    <p><strong>Valor Total:</strong> ${this.formatarMoeda(gasto.valor)}</p>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Valor Recebido (R$)</label>
                    <input type="number" id="valorPagamentoParcial" 
                           value="${gasto.valor}" 
                           min="0.01" max="${gasto.valor}" step="0.01"
                           style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Cancelar
                    </button>
                    <button onclick="app.receberPagamentoParcial(${gastoId}, parseFloat(document.getElementById('valorPagamentoParcial').value)); this.parentElement.parentElement.parentElement.remove()" 
                            style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Confirmar Recebimento
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    calcularDataParcela(dataInicio, numeroParcela) {
        const data = new Date(dataInicio);
        data.setMonth(data.getMonth() + (numeroParcela - 1));
        return data.toISOString().split('T')[0];
    }

    // ========== FILTROS ==========
    aplicarFiltros() {
        const filtroStatus = document.getElementById('filtroStatus');
        const filtroPessoa = document.getElementById('filtroPessoa');
        const filtroData = document.getElementById('filtroData');

        this.filtrosAtivos = {
            status: filtroStatus ? filtroStatus.value : 'todos',
            pessoa: filtroPessoa ? filtroPessoa.value : 'todos',
            data: filtroData ? filtroData.value : ''
        };
        this.atualizarListaTransacoes();
    }

    limparFiltros() {
        const filtroStatus = document.getElementById('filtroStatus');
        const filtroPessoa = document.getElementById('filtroPessoa');
        const filtroData = document.getElementById('filtroData');

        if (filtroStatus) filtroStatus.value = 'todos';
        if (filtroPessoa) filtroPessoa.value = 'todos';
        if (filtroData) filtroData.value = '';
        
        this.filtrosAtivos = { status: 'todos', pessoa: 'todos', data: '' };
        this.atualizarListaTransacoes();
    }

    // ========== PAGAMENTOS ==========
    marcarComoPago(gastoId) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (gasto) {
            // REGRA 1 e 4: Só marca como pago quando clicar
            if (gasto.responsavel !== 'Eu') {
                this.mostrarModalPagamentoParcial(gastoId);
                return;
            }
            
            gasto.pago = true;
            gasto.dataPagamento = new Date().toISOString().split('T')[0];
            this.mostrarToast('Gasto pago!', 'success');
            
            this.salvarDados('gastos', this.gastos);
            this.refreshCompleto();
        }
    }

    // ========== ATUALIZAÇÕES DE INTERFACE ==========
    atualizarDashboard() {
        const mesAtual = new Date().toISOString().slice(0, 7);
        
        // REGRA 1: Só conta gastos pagos no mês
        const gastosMes = this.gastos
            .filter(g => g.data.startsWith(mesAtual) && g.pago)
            .reduce((sum, g) => sum + g.valor, 0);

        const ganhosMes = this.ganhos
            .filter(g => g.data.startsWith(mesAtual))
            .reduce((sum, g) => sum + g.valor, 0);

        const saldoMes = ganhosMes - gastosMes;
        const saldoTotal = this.calcularSaldoTotal();

        // REGRA 6: Pendentes a pagar (meus gastos não pagos)
        const gastosPendentes = this.gastos
            .filter(g => !g.pago && g.responsavel === 'Eu')
            .reduce((sum, g) => sum + g.valor, 0);

        const gastosPagados = this.gastos
            .filter(g => g.pago)
            .reduce((sum, g) => sum + g.valor, 0);

        // REGRA 3: A receber (gastos de outras pessoas não pagos)
        const pendenteReceber = this.gastos
            .filter(g => !g.pago && g.responsavel !== 'Eu')
            .reduce((sum, g) => sum + g.valor, 0);

        // Atualizar elementos
        this.atualizarElementoTexto('ganhos-mes', this.formatarMoeda(ganhosMes));
        this.atualizarElementoTexto('gastos-mes', this.formatarMoeda(gastosMes));
        this.atualizarElementoTexto('saldo-mes', this.formatarMoeda(saldoMes));
        this.atualizarElementoTexto('saldo', this.formatarMoeda(saldoTotal));
        this.atualizarElementoTexto('gastos-pendentes', this.formatarMoeda(gastosPendentes));
        this.atualizarElementoTexto('gastos-pagos', this.formatarMoeda(gastosPagados));
        this.atualizarElementoTexto('pendente-receber', this.formatarMoeda(pendenteReceber));

        this.atualizarAlertas(ganhosMes, gastosMes, gastosPendentes, pendenteReceber);
        this.atualizarStatsRapidos();
        this.atualizarPrevisaoPessoas(); // REGRA 7
    }

    atualizarElementoTexto(id, texto) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = texto;
        }
    }

    atualizarAlertas(ganhosMes, gastosMes, gastosPendentes, pendenteReceber) {
        const alertasContainer = document.getElementById('alertas');
        if (!alertasContainer) return;

        let alertasHTML = '';

        if (this.gastos.length === 0 && this.ganhos.length === 0) {
            alertasHTML = '<div class="alerta info"><i class="fas fa-info-circle"></i><span>Bem-vindo! Adicione seus primeiros gastos e ganhos.</span></div>';
        } else {
            if (ganhosMes > 0) {
                const proporcao = (gastosMes / ganhosMes) * 100;
                if (proporcao > 90) {
                    alertasHTML += `<div class="alerta danger"><i class="fas fa-exclamation-triangle"></i><span>🚨 Gastando ${proporcao.toFixed(1)}% dos ganhos!</span></div>`;
                } else if (proporcao > 70) {
                    alertasHTML += `<div class="alerta warning"><i class="fas fa-exclamation-circle"></i><span>⚠️ Cuidado! ${proporcao.toFixed(1)}% dos ganhos</span></div>`;
                }
            }

            if (pendenteReceber > 0) {
                alertasHTML += `<div class="alerta info"><i class="fas fa-hand-holding-usd"></i><span>💰 R$ ${pendenteReceber.toFixed(2)} a receber</span></div>`;
            }

            if (gastosPendentes > 0) {
                alertasHTML += `<div class="alerta warning"><i class="fas fa-clock"></i><span>⏰ R$ ${gastosPendentes.toFixed(2)} em gastos pendentes</span></div>`;
            }

            const recorrentesAtivos = this.recorrentes.filter(r => r.ativo && r.responsavel === 'Eu');
            if (recorrentesAtivos.length > 0) {
                const totalRecorrente = recorrentesAtivos.reduce((sum, r) => sum + r.valor, 0);
                alertasHTML += `<div class="alerta info"><i class="fas fa-sync-alt"></i><span>🔄 R$ ${totalRecorrente.toFixed(2)} em recorrentes</span></div>`;
            }

            if (!alertasHTML) {
                alertasHTML = '<div class="alerta success"><i class="fas fa-check-circle"></i><span>✅ Finanças sob controle!</span></div>';
            }
        }

        alertasContainer.innerHTML = alertasHTML;
    }

    atualizarStatsRapidos() {
        const alimentacao = this.gastos
            .filter(g => g.categoria === 'alimentação' && g.responsavel === 'Eu' && g.pago)
            .reduce((sum, g) => sum + g.valor, 0);
        
        const transporte = this.gastos
            .filter(g => g.categoria === 'transporte' && g.responsavel === 'Eu' && g.pago)
            .reduce((sum, g) => sum + g.valor, 0);
        
        const aReceber = this.gastos
            .filter(g => !g.pago && g.responsavel !== 'Eu')
            .reduce((sum, g) => sum + g.valor, 0);

        this.atualizarElementoTexto('stat-alimentacao', this.formatarMoeda(alimentacao));
        this.atualizarElementoTexto('stat-transporte', this.formatarMoeda(transporte));
        this.atualizarElementoTexto('stat-areceber', this.formatarMoeda(aReceber));
    }

    // REGRA 7: Atualizar previsão para pessoas
    atualizarPrevisaoPessoas() {
        this.pessoas.forEach(pessoa => {
            if (pessoa !== 'Eu') {
                this.calcularPrevisaoPessoa(pessoa);
            }
        });
    }

    calcularPrevisaoPessoa(pessoa) {
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        
        let totalProximoMes = 0;
        let totalMesesSeguintes = 0;

        // Calcular para o próximo mês
        const proximoMes = new Date(anoAtual, mesAtual + 1, 1);
        const mesProximo = proximoMes.getMonth();
        const anoProximo = proximoMes.getFullYear();

        // Gastos recorrentes da pessoa
        const recorrentesPessoa = this.recorrentes.filter(r => 
            r.responsavel === pessoa && r.ativo
        );

        recorrentesPessoa.forEach(recorrente => {
            if (recorrente.tipo === 'parcelado') {
                // Calcular parcelas futuras
                const parcelasRestantes = recorrente.parcelas - recorrente.parcelasPagas;
                for (let i = 1; i <= parcelasRestantes; i++) {
                    const dataParcela = this.calcularDataParcela(recorrente.dataInicio, recorrente.parcelasPagas + i);
                    const dataParcelaObj = new Date(dataParcela);
                    
                    if (dataParcelaObj.getMonth() === mesProximo && dataParcelaObj.getFullYear() === anoProximo) {
                        totalProximoMes += recorrente.valor;
                    } else if (dataParcelaObj > proximoMes) {
                        totalMesesSeguintes += recorrente.valor;
                    }
                }
            } else {
                // Recorrente fixo - sempre conta para o próximo mês
                totalProximoMes += recorrente.valor;
            }
        });

        // Atualizar interface se necessário
        console.log(`Previsão para ${pessoa}: Próximo mês R$ ${totalProximoMes}, Seguintes R$ ${totalMesesSeguintes}`);
    }

    // ========== ATUALIZAR LISTA RECORRENTES ==========
    atualizarListaRecorrentes() {
        const container = document.getElementById('lista-recorrentes');
        if (!container) return;
        
        if (this.recorrentes.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-sync-alt"></i><p>Nenhum recorrente</p></div>';
            return;
        }

        container.innerHTML = this.recorrentes.map(recorrente => {
            const isParcelado = recorrente.tipo === 'parcelado';
            const progresso = isParcelado ? `${recorrente.parcelasPagas}/${recorrente.parcelas}` : 'Fixo';
            const porcentagem = isParcelado ? Math.round((recorrente.parcelasPagas / recorrente.parcelas) * 100) : 0;
            const valorPago = isParcelado ? recorrente.parcelasPagas * recorrente.valor : 0;
            const valorTotal = isParcelado ? recorrente.parcelas * recorrente.valor : recorrente.valor;
            
            const statusIcon = recorrente.ativo ? '🔵' : '⚪';
            const pessoaIcon = recorrente.responsavel !== 'Eu' ? '👤' : '💼';

            return `
                <div class="recurring-item ${!recorrente.ativo ? 'inativo' : ''}">
                    <div class="recurring-info">
                        <div class="recurring-header">
                            <strong>${statusIcon} ${pessoaIcon} ${recorrente.descricao}</strong>
                            <div class="recurring-actions-top">
                                <button class="btn-icon small ${recorrente.ativo ? 'danger' : 'success'}" 
                                        onclick="app.toggleRecorrenteAtivo(${recorrente.id})" 
                                        title="${recorrente.ativo ? 'Desativar' : 'Ativar'}">
                                    <i class="fas fa-power-off"></i>
                                </button>
                            </div>
                        </div>
                        <div class="recurring-meta">
                            ${this.formatarMoeda(recorrente.valor)} • ${recorrente.categoria}
                            ${recorrente.responsavel !== 'Eu' ? ` • 👤 ${recorrente.responsavel}` : ''}
                            • Início: ${this.formatarData(recorrente.dataInicio)}
                        </div>
                        ${isParcelado ? `
                            <div class="parcela-info">
                                <div>Parcelado: ${progresso}</div>
                                <div class="progresso">
                                    <span>${porcentagem}%</span>
                                    <span>${this.formatarMoeda(valorPago)} / ${this.formatarMoeda(valorTotal)}</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="recurring-actions">
                        ${isParcelado && recorrente.ativo && recorrente.parcelasPagas < recorrente.parcelas ? `
                            <button class="btn-pagar" onclick="app.marcarParcelaPaga(${recorrente.id})" title="Marcar parcela como paga">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="app.editarRecorrente(${recorrente.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="app.excluirRecorrente(${recorrente.id})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    atualizarListaTransacoes() {
        const container = document.getElementById('lista-transacoes');
        if (!container) return;

        let transacoesFiltradas = [...this.gastos, ...this.ganhos];

        // Aplicar filtros
        if (this.filtrosAtivos.status !== 'todos') {
            transacoesFiltradas = transacoesFiltradas.filter(t => {
                if (t.tipo === 'ganho') return true;
                return this.filtrosAtivos.status === 'pendente' ? !t.pago : t.pago;
            });
        }

        if (this.filtrosAtivos.pessoa !== 'todos') {
            transacoesFiltradas = transacoesFiltradas.filter(t => {
                if (t.tipo === 'ganho') return true;
                return t.responsavel === this.filtrosAtivos.pessoa;
            });
        }

        if (this.filtrosAtivos.data) {
            transacoesFiltradas = transacoesFiltradas.filter(t => t.data.startsWith(this.filtrosAtivos.data));
        }

        transacoesFiltradas = transacoesFiltradas
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);

        if (transacoesFiltradas.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma transação</p></div>';
            return;
        }

        container.innerHTML = transacoesFiltradas.map(trans => {
            const isGasto = trans.tipo === 'gasto';
            const isPago = trans.pago;
            const isDeTerceiro = trans.responsavel && trans.responsavel !== 'Eu';
            const isRecorrente = trans.recorrenteId;
            const isCartao = trans.cartaoId;
            
            let statusBadge = '';
            if (isGasto) {
                statusBadge = isPago ? 
                    '<span class="status-badge pago">PAGO</span>' : 
                    '<span class="status-badge pendente">PENDENTE</span>';
            }

            let pessoaBadge = '';
            if (isDeTerceiro) {
                pessoaBadge = '<span class="status-badge info">PESSOA</span>';
            }

            let recorrenteBadge = '';
            if (isRecorrente) {
                recorrenteBadge = '<span class="status-badge warning">RECORRENTE</span>';
            }

            let cartaoBadge = '';
            if (isCartao) {
                cartaoBadge = '<span class="status-badge info">CARTÃO</span>';
            }

            return `
                <div class="transaction-item ${isGasto && !isPago ? 'pendente' : ''}">
                    <div class="transaction-info">
                        <div class="transaction-header">
                            <strong>${trans.descricao}</strong>
                            <div>
                                ${statusBadge}
                                ${pessoaBadge}
                                ${recorrenteBadge}
                                ${cartaoBadge}
                            </div>
                        </div>
                        <div class="transaction-meta">
                            ${this.formatarData(trans.data)}
                            ${trans.categoria ? ` • ${this.formatarCategoria(trans.categoria)}` : ''}
                            ${isDeTerceiro ? ` • 👤 ${trans.responsavel}` : ''}
                            ${trans.pago ? ` • ✅ Pago em ${this.formatarData(trans.dataPagamento)}` : ''}
                        </div>
                    </div>
                    <div class="transaction-actions">
                        <div class="transaction-value ${trans.tipo}">
                            ${trans.tipo === 'ganho' ? '+' : '-'} ${this.formatarMoeda(trans.valor)}
                        </div>
                        <div class="action-buttons-small">
                            ${isGasto && !isPago ? `
                                <button class="btn-pagar" onclick="app.marcarComoPago(${trans.id})" title="Marcar como pago">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            <button class="btn-icon small" onclick="app.${isGasto ? 'editarGasto' : 'editarGanho'}(${trans.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon small danger" onclick="app.${isGasto ? 'excluirGasto' : 'excluirGanho'}(${trans.id})" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ========== ATUALIZAR LISTA PESSOAS ==========
    atualizarListaPessoas() {
        const container = document.getElementById('lista-pessoas');
        if (!container) return;
        
        if (this.pessoas.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Nenhuma pessoa cadastrada</p></div>';
            return;
        }

        container.innerHTML = this.pessoas.map((pessoa, index) => {
            if (pessoa === 'Eu') return ''; // Não mostra "Eu" na lista
            
            const gastosPessoa = this.gastos.filter(g => g.responsavel === pessoa);
            const totalDevendo = gastosPessoa.filter(g => !g.pago).reduce((sum, g) => sum + g.valor, 0);
            const totalPago = gastosPessoa.filter(g => g.pago).reduce((sum, g) => sum + g.valor, 0);
            
            // REGRA 3: SOMA CONSOLIDADA POR MÊS - MELHORADA
            const previsaoMensal = this.calcularPrevisaoMensalPessoa(pessoa);
            
            return `
                <div class="person-item">
                    <div class="person-info">
                        <strong>👤 ${pessoa}</strong>
                        <div class="person-stats">
                            <div class="person-stat">
                                <span class="stat-label">Total a Receber:</span>
                                <span class="stat-value pendente">${this.formatarMoeda(totalDevendo)}</span>
                            </div>
                            <div class="person-stat">
                                <span class="stat-label">Já Recebido:</span>
                                <span class="stat-value pago">${this.formatarMoeda(totalPago)}</span>
                            </div>
                        </div>
                        
                        <!-- VISÃO CONSOLIDADA POR MÊS - NOVA SEÇÃO -->
                        <div class="previsao-mensal">
                            <h4>📅 Previsão por Mês</h4>
                            ${previsaoMensal.map(previsao => `
                                <div class="previsao-mes-item">
                                    <span class="mes-label">${previsao.mes}:</span>
                                    <span class="mes-valor">${this.formatarMoeda(previsao.total)}</span>
                                    ${previsao.parcelas > 0 ? `<small>(${previsao.parcelas} parcela(s))</small>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="person-actions">
                        <button class="btn-icon" onclick="app.verDetalhesCompletosPessoa('${pessoa}')" title="Ver detalhes completos">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                        <button class="btn-icon" onclick="app.verDetalhesPessoa(${index})" title="Ver gastos">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="app.editarPessoa(${index})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="app.excluirPessoa(${index})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // NOVO MÉTODO: Cálculo detalhado por mês
    calcularPrevisaoMensalPessoa(pessoa) {
        const hoje = new Date();
        const previsoes = [];
        
        // Calcula para os próximos 6 meses
        for (let i = 0; i < 6; i++) {
            const mesData = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
            const mes = mesData.getMonth();
            const ano = mesData.getFullYear();
            
            // Gastos diretos da pessoa
            const gastosMes = this.gastos.filter(g => 
                g.responsavel === pessoa && 
                !g.pago
            ).filter(gasto => {
                const dataGasto = new Date(gasto.data);
                return dataGasto.getMonth() === mes && dataGasto.getFullYear() === ano;
            });

            const totalGastos = gastosMes.reduce((sum, gasto) => sum + gasto.valor, 0);
            const parcelasGastos = gastosMes.length;
            
            // Recorrentes da pessoa
            const recorrentesMes = this.recorrentes.filter(r => 
                r.responsavel === pessoa && 
                r.ativo
            ).filter(recorrente => {
                if (recorrente.tipo === 'parcelado') {
                    const parcelasRestantes = recorrente.parcelas - recorrente.parcelasPagas;
                    for (let p = 1; p <= parcelasRestantes; p++) {
                        const dataParcela = this.calcularDataParcela(recorrente.dataInicio, recorrente.parcelasPagas + p);
                        const dataParcelaObj = new Date(dataParcela);
                        if (dataParcelaObj.getMonth() === mes && dataParcelaObj.getFullYear() === ano) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    // Recorrente fixo - sempre conta
                    return true;
                }
            });

            const totalRecorrentes = recorrentesMes.reduce((sum, r) => sum + r.valor, 0);
            const parcelasRecorrentes = recorrentesMes.reduce((sum, r) => {
                if (r.tipo === 'parcelado') {
                    return sum + (r.parcelas - r.parcelasPagas);
                }
                return sum + 1;
            }, 0);

            const totalMes = totalGastos + totalRecorrentes;
            const totalParcelas = parcelasGastos + parcelasRecorrentes;
            
            if (totalMes > 0) {
                const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                previsoes.push({
                    mes: `${meses[mes]}/${ano.toString().slice(2)}`,
                    total: totalMes,
                    parcelas: totalParcelas,
                    detalhes: {
                        gastos: totalGastos,
                        recorrentes: totalRecorrentes
                    }
                });
            }
        }
        
        return previsoes;
    }

    // NOVO MÉTODO: Detalhes completos da pessoa
    verDetalhesCompletosPessoa(nomePessoa) {
        const gastosPessoa = this.gastos.filter(g => g.responsavel === nomePessoa);
        const previsaoMensal = this.calcularPrevisaoMensalPessoa(nomePessoa);
        
        let detalhesHTML = `
            <h3>👤 ${nomePessoa} - Visão Completa</h3>
            <div class="detalhes-completos-pessoa">
                
                <div class="resumo-geral">
                    <h4>📊 Resumo Geral</h4>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-label">Total a Receber</span>
                            <span class="stat-value pendente">
                                ${this.formatarMoeda(gastosPessoa.filter(g => !g.pago).reduce((sum, g) => sum + g.valor, 0))}
                            </span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Já Recebido</span>
                            <span class="stat-value pago">
                                ${this.formatarMoeda(gastosPessoa.filter(g => g.pago).reduce((sum, g) => sum + g.valor, 0))}
                            </span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Parcelas Pendentes</span>
                            <span class="stat-value info">
                                ${gastosPessoa.filter(g => !g.pago).length}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="previsao-mensal-detalhada">
                    <h4>📅 Previsão Mensal Detalhada</h4>
                    <div class="tabela-previsao">
                        <div class="tabela-header">
                            <span>Mês</span>
                            <span>Total</span>
                            <span>Parcelas</span>
                            <span>Detalhes</span>
                        </div>
        `;
        
        previsaoMensal.forEach(previsao => {
            detalhesHTML += `
                <div class="tabela-row">
                    <span class="mes">${previsao.mes}</span>
                    <span class="valor">${this.formatarMoeda(previsao.total)}</span>
                    <span class="parcelas">${previsao.parcelas}</span>
                    <span class="detalhes">
                        Gastos: ${this.formatarMoeda(previsao.detalhes.gastos)} | 
                        Recorrentes: ${this.formatarMoeda(previsao.detalhes.recorrentes)}
                    </span>
                </div>
            `;
        });
        
        detalhesHTML += `
                    </div>
                </div>
                
                <div class="gastos-pendentes">
                    <h4>⏰ Gastos Pendentes</h4>
                    <div class="lista-gastos-pendentes">
        `;
        
        const gastosPendentes = gastosPessoa.filter(g => !g.pago)
            .sort((a, b) => new Date(a.data) - new Date(b.data));
        
        gastosPendentes.forEach(gasto => {
            detalhesHTML += `
                <div class="gasto-pendente-item">
                    <div class="gasto-info">
                        <strong>${gasto.descricao}</strong>
                        <div class="gasto-meta">
                            ${this.formatarData(gasto.data)} • ${gasto.categoria}
                            ${gasto.parcelaNumero ? ` • Parcela ${gasto.parcelaNumero}/${gasto.totalParcelas}` : ''}
                        </div>
                    </div>
                    <div class="gasto-actions">
                        <span class="valor">${this.formatarMoeda(gasto.valor)}</span>
                        <button class="btn-pagar small" onclick="app.mostrarModalPagamentoParcial(${gasto.id})">
                            <i class="fas fa-hand-holding-usd"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        detalhesHTML += `
                    </div>
                </div>
            </div>
        `;
        
        this.mostrarModalDetalhes(detalhesHTML);
    }

    // ========== DETALHES PESSOA ==========
    verDetalhesPessoa(index) {
        const nomePessoa = this.pessoas[index];
        const gastosPessoa = this.gastos.filter(g => g.responsavel === nomePessoa);
        const previsaoMensal = this.calcularPrevisaoMensalPessoa(nomePessoa);
        
        let detalhesHTML = `
            <h3>👤 ${nomePessoa}</h3>
            <div class="detalhes-pessoa">
                <div class="resumo-pessoa">
                    <h4>📊 Resumo</h4>
                    <div class="stats-pessoa">
                        <div class="stat-pessoa">
                            <span>Total de Gastos:</span>
                            <strong>${this.formatarMoeda(gastosPessoa.reduce((sum, g) => sum + g.valor, 0))}</strong>
                        </div>
                        <div class="stat-pessoa">
                            <span>Pendente:</span>
                            <strong class="pendente">${this.formatarMoeda(gastosPessoa.filter(g => !g.pago).reduce((sum, g) => sum + g.valor, 0))}</strong>
                        </div>
                        <div class="stat-pessoa">
                            <span>Pago:</span>
                            <strong class="pago">${this.formatarMoeda(gastosPessoa.filter(g => g.pago).reduce((sum, g) => sum + g.valor, 0))}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="previsao-mensal-detalhada">
                    <h4>📅 Previsão Mensal</h4>
                    <div class="tabela-previsao-simples">
        `;
        
        previsaoMensal.forEach(previsao => {
            detalhesHTML += `
                <div class="previsao-mes-simples">
                    <span class="mes">${previsao.mes}</span>
                    <span class="valor">${this.formatarMoeda(previsao.total)}</span>
                    <span class="parcelas">${previsao.parcelas} parc.</span>
                </div>
            `;
        });
        
        detalhesHTML += `
                    </div>
                </div>
                
                <div class="gastos-pessoa">
                    <h4>⏰ Gastos Detalhados</h4>
                    <div class="lista-gastos-pessoa">
        `;

        const gastosOrdenados = gastosPessoa.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        gastosOrdenados.forEach(gasto => {
            detalhesHTML += `
                <div class="gasto-pessoa-item ${gasto.pago ? 'pago' : 'pendente'}">
                    <div class="gasto-info">
                        <strong>${gasto.descricao}</strong>
                        <div class="gasto-meta">
                            ${this.formatarData(gasto.data)} • ${gasto.categoria}
                            ${gasto.pago ? ` • ✅ Pago em ${this.formatarData(gasto.dataPagamento)}` : ''}
                            ${gasto.parcelaNumero ? ` • Parcela ${gasto.parcelaNumero}/${gasto.totalParcelas}` : ''}
                        </div>
                    </div>
                    <div class="gasto-actions">
                        <span class="valor">${this.formatarMoeda(gasto.valor)}</span>
                        ${!gasto.pago ? `
                            <button class="btn-pagar small" onclick="app.mostrarModalPagamentoParcial(${gasto.id})">
                                <i class="fas fa-hand-holding-usd"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        detalhesHTML += `
                    </div>
                </div>
                
                <div class="detalhes-actions">
                    <button class="btn-primary" onclick="app.verDetalhesCompletosPessoa('${nomePessoa}')">
                        <i class="fas fa-chart-bar"></i> Ver Visão Completa
                    </button>
                </div>
            </div>
        `;
        
        this.mostrarModalDetalhes(detalhesHTML);
    }

    mostrarModalDetalhes(conteudo) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); display: flex; align-items: center; 
            justify-content: center; z-index: 1000; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 15px; 
                       max-width: 500px; width: 100%; max-height: 80vh; overflow: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #333;"></h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: none; border: none; font-size: 1.5em; cursor: pointer; color: #666;">
                        ✕
                    </button>
                </div>
                ${conteudo}
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // ========== CRUD CARTÕES ==========
    salvarCartao() {
        const id = document.getElementById('cartaoId');
        const nome = document.getElementById('nomeCartao');
        const limite = document.getElementById('limiteCartao');
        const diaFechamento = document.getElementById('diaFechamento');
        const diaVencimento = document.getElementById('diaVencimento');

        if (!nome || !limite || !diaFechamento || !diaVencimento) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        if (!nome.value || !limite.value || !diaFechamento.value || !diaVencimento.value) {
            this.mostrarToast('Preencha todos os campos!', 'error');
            return;
        }

        const cartao = {
            id: id.value ? parseInt(id.value) : Date.now(),
            nome: nome.value,
            limite: parseFloat(limite.value),
            diaFechamento: parseInt(diaFechamento.value),
            diaVencimento: parseInt(diaVencimento.value),
            ativo: true,
            timestamp: new Date().toISOString()
        };

        if (id.value) {
            const index = this.cartoes.findIndex(c => c.id === parseInt(id.value));
            if (index !== -1) {
                this.cartoes[index] = { ...this.cartoes[index], ...cartao };
                this.mostrarToast('Cartão atualizado!', 'success');
            }
        } else {
            this.cartoes.push(cartao);
            this.mostrarToast('Cartão adicionado!', 'success');
        }

        this.salvarDados('cartoes', this.cartoes);
        this.fecharModal('cartao');
        this.atualizarListaCartoes();
        this.carregarSelectCartoes();
    }

    carregarSelectCartoes() {
        const cartaoCompra = document.getElementById('cartaoCompra');
        
        if (cartaoCompra) {
            cartaoCompra.innerHTML = '<option value="">Selecione o cartão...</option>' +
                this.cartoes.map(c => `<option value="${c.id}">💳 ${c.nome}</option>`).join('');
        }
    }

    editarCartao(cartaoId) {
        const cartao = this.cartoes.find(c => c.id === cartaoId);
        if (cartao) {
            const idElement = document.getElementById('cartaoId');
            const nomeElement = document.getElementById('nomeCartao');
            const limiteElement = document.getElementById('limiteCartao');
            const diaFechamentoElement = document.getElementById('diaFechamento');
            const diaVencimentoElement = document.getElementById('diaVencimento');

            if (idElement) idElement.value = cartao.id;
            if (nomeElement) nomeElement.value = cartao.nome;
            if (limiteElement) limiteElement.value = cartao.limite;
            if (diaFechamentoElement) diaFechamentoElement.value = cartao.diaFechamento;
            if (diaVencimentoElement) diaVencimentoElement.value = cartao.diaVencimento;
            
            mostrarModal('cartao');
        }
    }

    excluirCartao(cartaoId) {
        this.mostrarConfirmacao('Excluir este cartão? Todas as compras serão perdidas.', () => {
            this.cartoes = this.cartoes.filter(c => c.id !== cartaoId);
            // Remove também as compras deste cartão
            this.comprasCartao = this.comprasCartao.filter(compra => compra.cartaoId !== cartaoId);
            
            this.salvarDados('cartoes', this.cartoes);
            this.salvarDados('comprasCartao', this.comprasCartao);
            this.atualizarListaCartoes();
            this.atualizarListaComprasCartao();
            this.mostrarToast('Cartão excluído!', 'success');
        });
    }

    // ========== COMPRAS NO CARTÃO ==========
    salvarCompraCartao() {
        const id = document.getElementById('compraCartaoId');
        const cartaoId = document.getElementById('cartaoCompra');
        const descricao = document.getElementById('descricaoCompraCartao');
        const valor = document.getElementById('valorCompraCartao');
        const categoria = document.getElementById('categoriaCompraCartao');
        const parcelas = document.getElementById('parcelasCompra');
        const dataCompra = document.getElementById('dataCompraCartao');

        if (!cartaoId || !descricao || !valor || !categoria || !parcelas || !dataCompra) {
            this.mostrarToast('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }

        if (!cartaoId.value || !descricao.value || !valor.value || !categoria.value) {
            this.mostrarToast('Preencha todos os campos!', 'error');
            return;
        }

        const compra = {
            id: id.value ? parseInt(id.value) : Date.now(),
            cartaoId: parseInt(cartaoId.value),
            descricao: descricao.value,
            valor: parseFloat(valor.value),
            categoria: categoria.value,
            parcelas: parseInt(parcelas.value),
            parcelasPagas: 0,
            dataCompra: dataCompra.value,
            ativa: true,
            timestamp: new Date().toISOString()
        };

        if (id.value) {
            const index = this.comprasCartao.findIndex(c => c.id === parseInt(id.value));
            if (index !== -1) {
                this.comprasCartao[index] = { ...this.comprasCartao[index], ...compra };
                this.mostrarToast('Compra atualizada!', 'success');
            }
        } else {
            this.comprasCartao.push(compra);
            this.mostrarToast('Compra adicionada!', 'success');
            
            // REGRA 4: Gera transações de gasto para o cartão
            this.gerarTransacoesCartao(compra);
        }

        this.salvarDados('comprasCartao', this.comprasCartao);
        this.fecharModal('compraCartao');
        this.atualizarListaComprasCartao();
        this.atualizarListaCartoes();
    }

    // REGRA 4: Gerar transações para compras no cartão
    gerarTransacoesCartao(compra) {
        const cartao = this.cartoes.find(c => c.id === compra.cartaoId);
        if (!cartao) return;

        const valorParcela = compra.valor / compra.parcelas;
        
        for (let i = 1; i <= compra.parcelas; i++) {
            const dataVencimento = this.calcularDataFaturaCartao(cartao, compra.dataCompra, i);
            
            const gastoExistente = this.gastos.find(gasto => 
                gasto.descricao === `💳 ${compra.descricao} (${i}/${compra.parcelas})` &&
                gasto.data === dataVencimento &&
                gasto.compraCartaoId === compra.id
            );
            
            if (!gastoExistente) {
                const novoGasto = {
                    id: Date.now() + Math.random() + i,
                    descricao: `💳 ${compra.descricao} (${i}/${compra.parcelas})`,
                    valor: valorParcela,
                    categoria: compra.categoria,
                    responsavel: 'Eu',
                    data: dataVencimento,
                    pago: false,
                    dataPagamento: null,
                    tipo: 'gasto',
                    cartaoId: compra.cartaoId,
                    compraCartaoId: compra.id,
                    parcelaNumero: i,
                    totalParcelas: compra.parcelas,
                    timestamp: new Date().toISOString()
                };
                
                this.gastos.push(novoGasto);
            }
        }
        
        this.salvarDados('gastos', this.gastos);
        this.refreshCompleto();
    }

    calcularDataFaturaCartao(cartao, dataCompra, numeroParcela) {
        const data = new Date(dataCompra);
        data.setMonth(data.getMonth() + (numeroParcela - 1));
        
        // Ajusta para o dia de vencimento do cartão
        const ano = data.getFullYear();
        const mes = data.getMonth();
        const diaVencimento = Math.min(cartao.diaVencimento, new Date(ano, mes + 1, 0).getDate());
        
        return new Date(ano, mes, diaVencimento).toISOString().split('T')[0];
    }

    // ========== ATUALIZAR LISTAS CARTÕES ==========
    atualizarListaCartoes() {
        const container = document.getElementById('lista-cartoes');
        if (!container) return;
        
        if (this.cartoes.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>Nenhum cartão cadastrado</p></div>';
            return;
        }

        container.innerHTML = this.cartoes.map(cartao => {
            const comprasCartao = this.comprasCartao.filter(c => c.cartaoId === cartao.id && c.ativa);
            const totalGasto = this.calcularTotalGastoCartao(cartao.id);
            const limiteDisponivel = cartao.limite - totalGasto;
            const faturaAtual = this.calcularFaturaAtual(cartao.id);
            const faturaProxima = this.calcularFaturaProxima(cartao.id);

            return `
                <div class="card-item">
                    <div class="card-info">
                        <strong>💳 ${cartao.nome}</strong>
                        <div class="card-meta">
                            Limite: ${this.formatarMoeda(cartao.limite)} • 
                            Fecha: ${cartao.diaFechamento} • 
                            Vence: ${cartao.diaVencimento}
                        </div>
                        <div class="card-stats">
                            <div class="card-stat">
                                <span class="label">Fatura Atual</span>
                                <span class="value fatura">${this.formatarMoeda(faturaAtual)}</span>
                            </div>
                            <div class="card-stat">
                                <span class="label">Limite Disponível</span>
                                <span class="value limite">${this.formatarMoeda(limiteDisponivel)}</span>
                            </div>
                        </div>
                        ${this.gerarPrevisaoFaturasCartao(cartao.id)}
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="app.editarCartao(${cartao.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="app.excluirCartao(${cartao.id})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Atualiza stats gerais
        this.atualizarStatsCartoes();
    }

    calcularTotalGastoCartao(cartaoId) {
        const compras = this.comprasCartao.filter(c => c.cartaoId === cartaoId && c.ativa);
        return compras.reduce((sum, compra) => sum + compra.valor, 0);
    }

    calcularFaturaAtual(cartaoId) {
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        
        const gastosCartao = this.gastos.filter(g => 
            g.cartaoId === cartaoId && 
            !g.pago
        );

        let total = 0;
        gastosCartao.forEach(gasto => {
            const dataGasto = new Date(gasto.data);
            if (dataGasto.getMonth() === mesAtual && dataGasto.getFullYear() === anoAtual) {
                total += gasto.valor;
            }
        });

        return total;
    }

    calcularFaturaProxima(cartaoId) {
        const hoje = new Date();
        const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        
        const gastosCartao = this.gastos.filter(g => 
            g.cartaoId === cartaoId && 
            !g.pago
        );

        let total = 0;
        gastosCartao.forEach(gasto => {
            const dataGasto = new Date(gasto.data);
            if (dataGasto.getMonth() === proximoMes.getMonth() && dataGasto.getFullYear() === proximoMes.getFullYear()) {
                total += gasto.valor;
            }
        });

        return total;
    }

    gerarPrevisaoFaturasCartao(cartaoId) {
        const previsoes = this.calcularPrevisaoFaturas(cartaoId);
        
        if (previsoes.length === 0) return '';
        
        let html = '<div class="previsao-faturas">';
        html += '<h4>Próximas Faturas:</h4>';
        
        previsoes.forEach(previsao => {
            html += `
                <div class="previsao-mes">
                    <span class="mes">${previsao.mes}</span>
                    <span class="valor">${this.formatarMoeda(previsao.valor)}</span>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    calcularPrevisaoFaturas(cartaoId) {
        const hoje = new Date();
        const previsoes = [];
        
        // Calcula para os próximos 6 meses
        for (let i = 0; i < 6; i++) {
            const mesData = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
            const mes = mesData.getMonth();
            const ano = mesData.getFullYear();
            
            const gastosMes = this.gastos.filter(g => 
                g.cartaoId === cartaoId && 
                !g.pago
            ).filter(gasto => {
                const dataGasto = new Date(gasto.data);
                return dataGasto.getMonth() === mes && dataGasto.getFullYear() === ano;
            });

            const total = gastosMes.reduce((sum, gasto) => sum + gasto.valor, 0);
            
            if (total > 0) {
                const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                previsoes.push({
                    mes: `${meses[mes]}/${ano.toString().slice(2)}`,
                    valor: total
                });
            }
        }
        
        return previsoes;
    }

    atualizarStatsCartoes() {
        const faturaAtualTotal = this.cartoes.reduce((sum, cartao) => sum + this.calcularFaturaAtual(cartao.id), 0);
        const faturaProximaTotal = this.cartoes.reduce((sum, cartao) => sum + this.calcularFaturaProxima(cartao.id), 0);
        const limiteTotal = this.cartoes.reduce((sum, cartao) => sum + cartao.limite, 0);
        const gastoTotal = this.cartoes.reduce((sum, cartao) => sum + this.calcularTotalGastoCartao(cartao.id), 0);
        const limiteDisponivelTotal = limiteTotal - gastoTotal;

        this.atualizarElementoTexto('fatura-atual', this.formatarMoeda(faturaAtualTotal));
        this.atualizarElementoTexto('fatura-proxima', this.formatarMoeda(faturaProximaTotal));
        this.atualizarElementoTexto('limite-disponivel', this.formatarMoeda(limiteDisponivelTotal));
    }

    atualizarListaComprasCartao() {
        const container = document.getElementById('lista-compras-cartao');
        if (!container) return;

        if (this.comprasCartao.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma compra no cartão</p></div>';
            return;
        }

        container.innerHTML = this.comprasCartao.map(compra => {
            const cartao = this.cartoes.find(c => c.id === compra.cartaoId);
            const cartaoNome = cartao ? cartao.nome : 'Cartão não encontrado';

            return `
                <div class="compra-cartao-item">
                    <div class="compra-cartao-header">
                        <div class="compra-cartao-info">
                            <strong>${compra.descricao}</strong>
                            <div class="compra-cartao-meta">
                                💳 ${cartaoNome} • ${this.formatarData(compra.dataCompra)} • ${this.formatarCategoria(compra.categoria)}
                            </div>
                        </div>
                        <div class="compra-cartao-actions">
                            <span class="compra-cartao-parcelas">${compra.parcelasPagas}/${compra.parcelas} parc.</span>
                            <span class="transaction-value gasto">${this.formatarMoeda(compra.valor)}</span>
                            <button class="btn-icon small danger" onclick="app.excluirCompraCartao(${compra.id})" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    excluirCompraCartao(compraId) {
        this.mostrarConfirmacao('Excluir esta compra? Todas as parcelas serão removidas.', () => {
            // Remove a compra
            this.comprasCartao = this.comprasCartao.filter(c => c.id !== compraId);
            // Remove as transações geradas por esta compra
            this.gastos = this.gastos.filter(g => g.compraCartaoId !== compraId);
            
            this.salvarDados('comprasCartao', this.comprasCartao);
            this.salvarDados('gastos', this.gastos);
            this.atualizarListaComprasCartao();
            this.atualizarListaCartoes();
            this.refreshCompleto();
            this.mostrarToast('Compra excluída!', 'success');
        });
    }

    // ========== UTILITÁRIOS ==========
    carregarSelectPessoas() {
        const responsavelGasto = document.getElementById('responsavelGasto');
        const responsavelRecorrente = document.getElementById('responsavelRecorrente');
        
        const options = '<option value="Eu">👤 Eu</option>' +
            this.pessoas.map(p => `<option value="${p}">👤 ${p}</option>`).join('');

        if (responsavelGasto) {
            responsavelGasto.innerHTML = options;
        }
        if (responsavelRecorrente) {
            responsavelRecorrente.innerHTML = options;
        }
    }

    mostrarConfirmacao(mensagem, callback) {
        const modal = document.getElementById('modalConfirm');
        const message = document.getElementById('confirmMessage');
        const button = document.getElementById('confirmButton');

        if (!modal || !message || !button) {
            console.error('❌ Elementos do modal de confirmação não encontrados');
            return;
        }

        message.textContent = mensagem;
        button.onclick = () => {
            callback();
            modal.style.display = 'none';
        };
        modal.style.display = 'block';
    }

    mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.error('❌ Elemento toast não encontrado');
            return;
        }
        
        toast.textContent = mensagem;
        toast.className = `toast ${tipo} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    fecharModal(tipo) {
        const modal = document.getElementById(`modal${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        const form = document.getElementById(`form${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
        
        if (modal) {
            modal.style.display = 'none';
        }
        
        if (form) {
            form.reset();
            
            form.querySelectorAll('input[type="hidden"]').forEach(input => {
                if (input) input.value = '';
            });
            
            if (tipo === 'gasto' || tipo === 'ganho' || tipo === 'recorrente' || tipo === 'compraCartao') {
                const hoje = new Date().toISOString().split('T')[0];
                const dataElement = document.getElementById(`data${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
                if (dataElement) {
                    dataElement.value = hoje;
                }
            }
        }
        
        this.refreshCompleto();
    }

    // ========== PERSISTÊNCIA ==========
    salvarDados(chave, dados) {
        localStorage.setItem(`finance_${chave}`, JSON.stringify(dados));
    }

    carregarDados(chave) {
        try {
            return JSON.parse(localStorage.getItem(`finance_${chave}`));
        } catch (error) {
            console.error(`Erro ao carregar dados de ${chave}:`, error);
            return null;
        }
    }

    // ========== FORMATAÇÃO ==========
    formatarMoeda(valor) {
        return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }

    formatarData(dataISO) {
        try {
            return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR');
        } catch (error) {
            return dataISO;
        }
    }

    formatarMes(mesISO) {
        try {
            const [ano, mes] = mesISO.split('-');
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
        } catch (error) {
            return mesISO;
        }
    }

    formatarCategoria(categoria) {
        const categorias = {
            'alimentação': '🍕 Alimentação',
            'transporte': '🚗 Transporte',
            'lazer': '🎮 Lazer',
            'saúde': '🏥 Saúde',
            'educação': '📚 Educação',
            'moradia': '🏠 Moradia',
            'vestuário': '👕 Vestuário',
            'outros': '📦 Outros'
        };
        return categorias[categoria] || categoria;
    }

    calcularSaldoTotal() {
        const totalGanhos = this.ganhos.reduce((sum, g) => sum + g.valor, 0);
        const totalGastos = this.gastos.reduce((sum, g) => sum + g.valor, 0);
        return totalGanhos - totalGastos;
    }

    // ========== GRÁFICOS ==========
    gerarGraficos() {
        if (document.getElementById('graficoGastosGanhos')) {
            this.gerarGraficoGastosGanhos();
        }
        if (document.getElementById('graficoCategorias')) {
            this.gerarGraficoCategorias();
        }
        if (document.getElementById('graficoEvolucao')) {
            this.gerarGraficoEvolucao();
        }
    }

    gerarGraficoGastosGanhos() {
        const ctx = document.getElementById('graficoGastosGanhos');
        if (!ctx) {
            console.warn('Elemento graficoGastosGanhos não encontrado');
            return;
        }

        if (this.chartGastosGanhos) {
            this.chartGastosGanhos.destroy();
        }

        const meses = this.getUltimos6Meses();
        const dadosGanhos = meses.map(mes => 
            this.ganhos.filter(g => g.data.startsWith(mes)).reduce((sum, g) => sum + g.valor, 0)
        );
        const dadosGastos = meses.map(mes => 
            this.gastos.filter(g => g.data.startsWith(mes) && g.pago).reduce((sum, g) => sum + g.valor, 0)
        );

        try {
            this.chartGastosGanhos = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: meses.map(m => this.formatarMes(m)),
                    datasets: [
                        {
                            label: 'Ganhos', data: dadosGanhos,
                            backgroundColor: '#2ecc71', borderColor: '#27ae60', borderWidth: 1
                        },
                        {
                            label: 'Gastos', data: dadosGastos,
                            backgroundColor: '#e74c3c', borderColor: '#c0392b', borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { title: { display: true, text: 'Ganhos vs Gastos' } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: value => 'R$ ' + value }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao gerar gráfico de gastos vs ganhos:', error);
        }
    }

    gerarGraficoCategorias() {
        const ctx = document.getElementById('graficoCategorias');
        if (!ctx) {
            console.warn('Elemento graficoCategorias não encontrado');
            return;
        }

        if (this.chartCategorias) {
            this.chartCategorias.destroy();
        }

        const categorias = {};
        this.gastos.forEach(gasto => {
            if (gasto.pago) {
                categorias[gasto.categoria] = (categorias[gasto.categoria] || 0) + gasto.valor;
            }
        });

        if (Object.keys(categorias).length === 0) {
            const parentElement = ctx.parentElement;
            if (parentElement) {
                parentElement.innerHTML = '<p class="empty-state">Nenhum dado de gastos</p>';
            }
            return;
        }

        try {
            this.chartCategorias = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categorias).map(c => this.formatarCategoria(c)),
                    datasets: [{
                        data: Object.values(categorias),
                        backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribuição por Categoria'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao gerar gráfico de categorias:', error);
        }
    }

    gerarGraficoEvolucao() {
        const ctx = document.getElementById('graficoEvolucao');
        if (!ctx) {
            console.warn('Elemento graficoEvolucao não encontrado');
            return;
        }

        if (this.chartEvolucao) {
            this.chartEvolucao.destroy();
        }

        const meses = this.getUltimos6Meses();
        const saldos = meses.map(mes => {
            const ganhos = this.ganhos.filter(g => g.data.startsWith(mes)).reduce((sum, g) => sum + g.valor, 0);
            const gastos = this.gastos.filter(g => g.data.startsWith(mes) && g.pago).reduce((sum, g) => sum + g.valor, 0);
            return ganhos - gastos;
        });

        try {
            this.chartEvolucao = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: meses.map(m => this.formatarMes(m)),
                    datasets: [{
                        label: 'Saldo Mensal', data: saldos,
                        borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 3, fill: true, tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { title: { display: true, text: 'Evolução do Saldo' } },
                    scales: {
                        y: { ticks: { callback: value => 'R$ ' + value } }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao gerar gráfico de evolução:', error);
        }
    }

    getUltimos6Meses() {
        const meses = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            meses.push(date.toISOString().slice(0, 7));
        }
        return meses;
    }

    // ========== REFRESH AUTOMÁTICO ==========
    refreshCompleto() {
        this.atualizarDashboard();
        this.atualizarListaTransacoes();
        this.atualizarListaPessoas();
        this.atualizarListaRecorrentes();
        this.atualizarListaCartoes();
        this.atualizarListaComprasCartao();
        this.carregarSelectCartoes();
        
        if (document.getElementById('reports') && document.getElementById('reports').classList.contains('active')) {
            setTimeout(() => this.gerarGraficos(), 100);
        }
    }
}

// Funções globais
function mostrarModal(tipo) {
    const modal = document.getElementById(`modal${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    if (modal) {
        modal.style.display = 'block';
    }
}

function fecharModal(tipo) {
    if (window.app) {
        window.app.fecharModal(tipo);
    }
}

function atualizarGraficos() {
    if (window.app) {
        window.app.gerarGraficos();
        window.app.mostrarToast('Gráficos atualizados!', 'success');
    }
}

// Inicialização segura
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicação...');
    try {
        window.app = new FinanceApp();
        console.log('✅ Aplicação inicializada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar aplicação:', error);
        const alertasContainer = document.getElementById('alertas');
        if (alertasContainer) {
            alertasContainer.innerHTML = `
                <div class="alerta danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar o aplicativo. Recarregue a página.</span>
                </div>
            `;
        }
    }
});

// Forçar atualização de versão
const VERSION_ATUAL = '4.0';
if (localStorage.getItem('app_version') !== VERSION_ATUAL) {
    localStorage.setItem('app_version', VERSION_ATUAL);
    console.log('🆕 Nova versão instalada!');
}