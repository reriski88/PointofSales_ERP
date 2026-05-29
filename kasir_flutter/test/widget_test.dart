import 'package:flutter_test/flutter_test.dart';
import 'package:pos_cemilan_kasir/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('menampilkan form login kasir', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();

    expect(find.text('POS Cemilan Kasir'), findsOneWidget);
    expect(find.text('Server API'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Masuk'), findsOneWidget);
  });
}
