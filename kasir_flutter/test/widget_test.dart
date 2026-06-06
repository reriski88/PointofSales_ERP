import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:pos_cemilan_kasir/core/app/pos_cemilan_app.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('menampilkan form login kasir', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const PosCemilanApp());
    await tester.pumpAndSettle();

    expect(find.text('Smart POS ERP Kasir'), findsOneWidget);
    expect(find.text('Server API'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Masuk'), findsOneWidget);
  });

  testWidgets('form login responsif di phone dan tablet', (tester) async {
    for (final size in const [Size(390, 844), Size(800, 1280)]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(const PosCemilanApp());
      await tester.pumpAndSettle();

      expect(find.text('Smart POS ERP Kasir'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });
}
