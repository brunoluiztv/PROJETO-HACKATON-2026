"""
Tekó Biotech — Script de Carga/Reset de Dados para Demonstração de Bancada
Hackathon das Engenharias UERGS 2026
"""

from database import inicializar_banco, resetar_dados_demonstracao, obter_perfis_cultura, obter_historico_leituras

if __name__ == "__main__":
    print("🌱 Inicializando e resetando banco SQLite (phytosense.db)...")
    inicializar_banco()
    resultado = resetar_dados_demonstracao()
    print(f"✅ Sucesso: {resultado}")

    perfis = obter_perfis_cultura()
    print(f"\n🌾 Perfis Embrapa Carregados ({len(perfis)}):")
    for p in perfis:
        print(f" - [{p['id_perfil']}] {p['cultura']}: CC={p['tensao_capacidade_campo_kpa']} kPa | Manejo={p['tensao_critica_manejo_kpa']} kPa ({p['fonte_cientifica']})")

    leituras = obter_historico_leituras()
    print(f"\n📊 Total de Leituras Históricas: {len(leituras)}")
