import joblib

meta = joblib.load('model_metadata.pkl')
print('\n📊 All Feature Importances (sorted):')
print('=' * 60)
for f in sorted(meta['feature_importance'], key=lambda x: x['importance'], reverse=True):
    print(f'  {f["feature"]:35s}: {f["importance"]:.4f}')

print('\n✅ Fairness feature found!' if any('shifts_already_assigned' in f['feature'] for f in meta['feature_importance']) else '\n⚠️ Fairness feature not found!')


