from rest_framework import serializers

from stocks.models import Stock
from stocks.views import _resolve_symbol
from .models import Portfolio


def _script_code(normalized_symbol):
    return normalized_symbol.split('.')[0] if normalized_symbol else normalized_symbol


class PortfolioSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(required=True, allow_blank=False, write_only=True)
    current_price = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    pnl = serializers.SerializerMethodField()
    gross_pnl = serializers.SerializerMethodField()
    brokerage_cost = serializers.SerializerMethodField()
    net_pnl = serializers.SerializerMethodField()
    net_gain = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    daily_change_percent = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = [
            'id', 'symbol', 'display_name', 'quantity', 'buy_price',
            'date_added', 'current_price', 'total_value', 'pnl',
            'gross_pnl', 'brokerage_cost', 'net_pnl', 'net_gain',
            'daily_change_percent'
        ]
        read_only_fields = [
            'id', 'date_added', 'current_price', 'total_value',
            'pnl', 'gross_pnl', 'brokerage_cost', 'net_pnl', 'net_gain'
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate_buy_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Buy price must be greater than zero.')
        return value

    def validate_symbol(self, value):
        normalized = (value or '').strip().upper()
        if not normalized:
            raise serializers.ValidationError('A stock symbol is required.')
        return normalized

    def _resolve_stock(self, symbol):
        normalized = (symbol or '').strip().upper()
        if not normalized:
            return None

        # 1. Try canonical resolution first
        try:
            res = _resolve_symbol(normalized)
            if res and res[0]:
                resolved_symbol = res[0]
                info = res[1] or {}
                hist = res[2]
                stock_obj, _ = Stock.objects.get_or_create(symbol=resolved_symbol, defaults={'name': resolved_symbol})
                stock_obj.name = info.get('longName') or info.get('shortName') or stock_obj.name or resolved_symbol
                if hist is not None and not hist.empty:
                    valid_closes = hist['Close'].dropna()
                    valid_closes = valid_closes[valid_closes > 0]
                    if not valid_closes.empty:
                        stock_obj.current_price = float(valid_closes.iloc[-1])
                stock_obj.save()
                return stock_obj
        except Exception:
            pass

        # 2. Fallback to existing stock in DB
        stock = Stock.objects.filter(symbol__iexact=normalized).first()
        if not stock and '.' not in normalized:
            stock = Stock.objects.filter(symbol__iexact=f'{normalized}.NS').first()
            if not stock:
                stock = Stock.objects.filter(symbol__iexact=f'{normalized}.BO').first()

        return stock

    def create(self, validated_data):
        symbol = validated_data.pop('symbol', None)
        if not symbol:
            raise serializers.ValidationError({'symbol': 'A stock symbol is required.'})

        user = validated_data.pop('user', None) or self.context['request'].user
        stock = self._resolve_stock(symbol)
        if stock is None:
            stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})

        existing = Portfolio.objects.filter(user=user, stock=stock).first()
        if existing is not None:
            total_quantity = existing.quantity + validated_data['quantity']
            if total_quantity <= 0:
                raise serializers.ValidationError({'quantity': 'Total quantity must be greater than zero.'})

            weighted_price = (
                existing.buy_price * existing.quantity + validated_data['buy_price'] * validated_data['quantity']
            ) / total_quantity
            existing.quantity = total_quantity
            existing.buy_price = round(weighted_price, 2)
            existing.save()
            return existing

        return Portfolio.objects.create(user=user, stock=stock, **validated_data)

    def get_current_price(self, instance):
        return instance.stock.current_price or 0

    def get_display_name(self, instance):
        return f'{instance.stock.name} ({_script_code(instance.stock.symbol)})'

    def get_total_value(self, instance):
        return round((instance.stock.current_price or 0) * instance.quantity, 2)

    def get_gross_pnl(self, instance):
        current = instance.stock.current_price or 0
        return round((current - instance.buy_price) * instance.quantity, 2)

    def get_pnl(self, instance):
        return self.get_gross_pnl(instance)

    def get_brokerage_cost(self, instance):
        # 0.30% retail turnover brokerage fee (buy value + current value)
        current = instance.stock.current_price or instance.buy_price
        buy_val = instance.buy_price * instance.quantity
        curr_val = current * instance.quantity
        return round(0.003 * (buy_val + curr_val), 2)

    def get_net_pnl(self, instance):
        gross = self.get_gross_pnl(instance)
        brokerage = self.get_brokerage_cost(instance)
        return round(gross - brokerage, 2)

    def get_net_gain(self, instance):
        return self.get_net_pnl(instance)

    def get_daily_change_percent(self, instance):
        from stocks.models import StockHistory
        history = StockHistory.objects.filter(stock=instance.stock).order_by('-date')[:1]
        if history.exists():
            prev_close = history[0].close_price
            if prev_close > 0:
                current = instance.stock.current_price or prev_close
                change = ((current - prev_close) / prev_close) * 100
                return round(change, 2)
        return 0.0

    def to_representation(self, instance):
        data = super().to_representation(instance)
        raw_symbol = instance.stock.symbol
        data['symbol'] = raw_symbol.split('.')[0] if '.' in raw_symbol else raw_symbol
        return data
